// Основной класс приложения
class SurveyApp {
    constructor() {
        this.currentUser = null;
        this.surveys = JSON.parse(localStorage.getItem('surveys')) || [];
        this.responses = JSON.parse(localStorage.getItem('responses')) || [];
        this.currentSurvey = null;
        this.editingSurveyId = null;
        this.currentFilter = 'all';
        this.exportSurveyId = null;
        
        // Используем CORS-прокси для обхода ограничений
        this.apiBaseUrl = 'https://api.gym42.ru';
        this.proxyUrl = 'https://cors-anywhere.herokuapp.com/'; // Публичный CORS-прокси
        
        this.initializeEventListeners();
        this.checkAuth();
    }

    // Инициализация обработчиков событий
    initializeEventListeners() {
        // Авторизация
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Создание и редактирование анкеты
        document.getElementById('create-survey-btn').addEventListener('click', () => this.showCreateSurveyModal());
        document.getElementById('add-question-btn').addEventListener('click', () => this.addQuestion());
        document.getElementById('survey-form').addEventListener('submit', (e) => this.handleSaveSurvey(e));

        // Модальные окна
        document.querySelectorAll('.close').forEach(close => {
            close.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });
        
        document.querySelector('.cancel-btn').addEventListener('click', () => this.hideSurveyModal());
        document.querySelector('.cancel-export').addEventListener('click', () => this.hideExportModal());

        // Экспорт
        document.getElementById('confirm-export').addEventListener('click', () => this.handleExport());

        // Фильтры
        document.getElementById('filter-all').addEventListener('click', () => this.setFilter('all'));
        document.getElementById('filter-active').addEventListener('click', () => this.setFilter('active'));
        document.getElementById('filter-inactive').addEventListener('click', () => this.setFilter('inactive'));

        // Динамические обработчики
        document.addEventListener('click', (e) => {
            // Dropdown меню
            if (e.target.closest('.dropdown-btn')) {
                this.toggleDropdown(e.target.closest('.dropdown-btn'));
            } else {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });
            }

            // Удаление вопросов и вариантов
            if (e.target.classList.contains('remove-question-btn')) {
                e.target.closest('.question-card').remove();
                this.updateQuestionNumbers();
            }
            
            if (e.target.classList.contains('remove-option-btn')) {
                e.target.closest('.option-item').remove();
            }

            // Тип вопроса
            if (e.target.classList.contains('question-type')) {
                this.toggleOptions(e.target);
            }

            // Добавление вариантов
            if (e.target.classList.contains('add-option-btn')) {
                this.addOption(e.target.closest('.options-container'));
            }

            // Действия с анкетами
            if (e.target.closest('.copy-link-btn')) {
                this.copySurveyLink(e.target.closest('.survey-card'));
            }

            if (e.target.closest('.view-results-btn')) {
                this.viewResults(e.target.closest('.survey-card'));
            }

            if (e.target.closest('.export-results-btn')) {
                this.showExportModal(e.target.closest('.survey-card'));
            }

            if (e.target.closest('.delete-survey-btn')) {
                this.deleteSurvey(e.target.closest('.survey-card'));
            }

            if (e.target.closest('.edit-survey-btn')) {
                this.editSurvey(e.target.closest('.survey-card'));
            }

            if (e.target.closest('.toggle-status-btn')) {
                this.toggleSurveyStatus(e.target.closest('.survey-card'));
            }
        });

        // Закрытие модальных окон при клике вне их
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // Переключение dropdown меню
    toggleDropdown(button) {
        const menu = button.nextElementSibling;
        const isVisible = menu.classList.contains('show');
        
        document.querySelectorAll('.dropdown-menu').forEach(m => {
            m.classList.remove('show');
        });
        
        if (!isVisible) {
            menu.classList.add('show');
        }
    }

    // Проверка авторизации
    async checkAuth() {
        // Проверяем, есть ли сохраненные данные пользователя
        const savedUser = localStorage.getItem('currentUser');
        
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            
            // Пробуем проверить сессию на сервере
            try {
                this.showScreen('loading-screen');
                
                // Пробуем сначала без прокси
                const response = await this.fetchWithProxy(`${this.apiBaseUrl}/login/`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response && response.ok) {
                    const userData = await response.json();
                    // Обновляем данные пользователя
                    this.currentUser = {
                        ...this.currentUser,
                        ...userData
                    };
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    this.showUserPanel();
                } else {
                    // Если сессия недействительна, показываем экран входа
                    localStorage.removeItem('currentUser');
                    this.currentUser = null;
                    this.showScreen('login-screen');
                }
            } catch (error) {
                console.error('Ошибка проверки сессии:', error);
                // При ошибке сети показываем экран входа
                localStorage.removeItem('currentUser');
                this.currentUser = null;
                this.showScreen('login-screen');
            }
        } else {
            this.showScreen('login-screen');
        }
    }

    // Универсальная функция для запросов с поддержкой прокси
    async fetchWithProxy(url, options = {}) {
        const controllers = [];
        
        // Пробуем разные варианты запросов
        const strategies = [
            // 1. Прямой запрос
            async () => {
                const controller = new AbortController();
                controllers.push(controller);
                return await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
            },
            
            // 2. Запрос через CORS-прокси
            async () => {
                const controller = new AbortController();
                controllers.push(controller);
                return await fetch(this.proxyUrl + url, {
                    ...options,
                    signal: controller.signal
                });
            },
            
            // 3. Запрос с режимом no-cors
            async () => {
                const controller = new AbortController();
                controllers.push(controller);
                return await fetch(url, {
                    ...options,
                    mode: 'no-cors',
                    signal: controller.signal
                });
            }
        ];

        // Пробуем каждую стратегию по очереди
        for (const strategy of strategies) {
            try {
                console.log('Пробуем стратегию:', strategy.toString().substring(0, 100));
                const response = await strategy();
                
                // Отменяем остальные запросы
                controllers.forEach(c => c.abort());
                
                return response;
            } catch (error) {
                console.log('Стратегия не сработала:', error.message);
                // Продолжаем со следующей стратегией
            }
        }

        throw new Error('Все способы подключения не сработали');
    }

    // Обработка входа
    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const loginButton = document.getElementById('login-button');
        const loginError = document.getElementById('login-error');

        if (!username || !password) {
            loginError.textContent = 'Введите логин и пароль';
            loginError.style.display = 'block';
            return;
        }

        // Блокируем кнопку и показываем спиннер
        loginButton.disabled = true;
        loginButton.innerHTML = `
            <span>Вход...</span>
            <div class="spinner"></div>
        `;
        loginError.style.display = 'none';

        try {
            console.log('Попытка входа с логином:', username);
            
            // Пробуем разные способы авторизации
            let response = null;
            let error = null;
            
            // Способ 1: Прямой POST запрос
            try {
                response = await this.fetchWithProxy(`${this.apiBaseUrl}/login/`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        login: username,
                        password: password
                    })
                });
                
                console.log('Ответ от сервера:', response);
                
                if (response && response.ok) {
                    const responseText = await response.text();
                    console.log('Текст ответа:', responseText);
                    
                    if (responseText === 'OK') {
                        // Успешный вход
                        await this.getUserData();
                        return;
                    }
                }
            } catch (e) {
                error = e;
                console.log('Способ 1 не сработал:', e.message);
            }
            
            // Способ 2: Альтернативный формат данных
            try {
                response = await this.fetchWithProxy(`${this.apiBaseUrl}/login/`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: new URLSearchParams({
                        'login': username,
                        'password': password
                    })
                });
                
                if (response && response.ok) {
                    const responseText = await response.text();
                    if (responseText === 'OK') {
                        await this.getUserData();
                        return;
                    }
                }
            } catch (e) {
                error = e;
                console.log('Способ 2 не сработал:', e.message);
            }
            
            // Способ 3: GET с basic auth
            try {
                const basicAuth = btoa(`${username}:${password}`);
                response = await this.fetchWithProxy(`${this.apiBaseUrl}/login/`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Accept': 'application/json'
                    }
                });
                
                if (response && response.ok) {
                    const userData = await response.json();
                    if (userData && userData.login) {
                        this.currentUser = this.processUserData(userData);
                        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                        
                        this.showScreen('loading-screen');
                        setTimeout(() => {
                            this.showUserPanel();
                        }, 500);
                        return;
                    }
                }
            } catch (e) {
                error = e;
                console.log('Способ 3 не сработал:', e.message);
            }

            // Если все способы не сработали
            throw error || new Error('Не удалось авторизоваться');

        } catch (error) {
            console.error('Ошибка авторизации:', error);
            
            // Показываем демо-режим для тестирования
            if (confirm('Не удалось подключиться к серверу. Перейти в демо-режим?')) {
                this.startDemoMode(username);
            } else {
                loginError.textContent = 'Ошибка подключения к серверу. Проверьте соединение.';
                loginError.style.display = 'block';
                this.resetLoginButton();
            }
        }
    }

    // Запуск демо-режима
    startDemoMode(username) {
        // Создаем тестового пользователя
        const isAdmin = username.toLowerCase().includes('admin');
        
        this.currentUser = {
            login: username,
            fullname: isAdmin ? 'Администратор' : (username === 'astrunin' ? 'Аструнин А.А.' : 'Иванов И.И.'),
            f: isAdmin ? 'Администратор' : (username === 'astrunin' ? 'Аструнин' : 'Иванов'),
            i: 'А',
            o: 'А',
            userid: 1234,
            group: isAdmin ? 'Администраторы' : 'Ученики',
            groupid: isAdmin ? 2 : 1,
            tarif: isAdmin ? 'Администратор' : 'Ученический',
            tarifid: isAdmin ? 2 : 1,
            date_begin: new Date().toISOString(),
            date_end: '2037-06-30 23:59:59',
            role: isAdmin ? 'admin' : 'student',
            isDemo: true
        };

        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        
        this.showScreen('loading-screen');
        setTimeout(() => {
            this.showUserPanel();
            this.showNotification('Демо-режим: данные сохраняются локально', 'warning');
        }, 500);
    }

    // Получение данных пользователя после успешного входа
    async getUserData() {
        try {
            const userResponse = await this.fetchWithProxy(`${this.apiBaseUrl}/login/`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (userResponse && userResponse.ok) {
                const userData = await userResponse.json();
                console.log('Данные пользователя:', userData);
                
                this.currentUser = this.processUserData(userData);
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                
                this.showScreen('loading-screen');
                setTimeout(() => {
                    this.showUserPanel();
                }, 500);
            } else {
                throw new Error('Не удалось получить данные пользователя');
            }
        } catch (error) {
            console.error('Ошибка получения данных пользователя:', error);
            throw error;
        }
    }

    // Обработка данных пользователя
    processUserData(userData) {
        // Определяем роль на основе тарифа или группы
        const role = userData.tarif === 'Администратор' || userData.group === 'Администраторы' ? 'admin' : 'student';
        
        return {
            login: userData.login,
            fullname: userData.fullname || `${userData.f || ''} ${userData.i || ''}. ${userData.o || ''}.`,
            f: userData.f,
            i: userData.i,
            o: userData.o,
            userid: userData.userid,
            group: userData.group,
            groupid: userData.groupid,
            tarif: userData.tarif,
            tarifid: userData.tarifid,
            date_begin: userData.date_begin,
            date_end: userData.date_end,
            role: role,
            isDemo: false
        };
    }

    // Сброс кнопки входа
    resetLoginButton() {
        const loginButton = document.getElementById('login-button');
        loginButton.disabled = false;
        loginButton.innerHTML = `
            <i class="fas fa-sign-in-alt"></i>
            <span>Войти в систему</span>
        `;
    }

    // Выход из системы
    async handleLogout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        
        // Очищаем cookie
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        // Пробуем завершить сессию на сервере
        try {
            await this.fetchWithProxy(`${this.apiBaseUrl}/login/`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        }
        
        this.showScreen('login-screen');
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('login-form').reset();
        this.resetLoginButton();
    }

    // Показать соответствующую панель пользователя
    showUserPanel() {
        document.getElementById('user-name').textContent = this.currentUser.fullname || this.currentUser.login;
        document.getElementById('user-role').textContent = this.currentUser.tarif || (this.currentUser.group === 'Ученики' ? 'Ученик' : this.currentUser.group);
        document.getElementById('user-group').textContent = this.currentUser.group || '';
        
        // Добавляем индикатор демо-режима
        if (this.currentUser.isDemo) {
            const userInfo = document.getElementById('user-info');
            const demoBadge = document.createElement('span');
            demoBadge.className = 'demo-badge';
            demoBadge.textContent = 'ДЕМО';
            demoBadge.style.cssText = `
                background: var(--warning);
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.7rem;
                margin-left: 0.5rem;
            `;
            userInfo.querySelector('.user-details').appendChild(demoBadge);
        }
        
        document.getElementById('user-info').style.display = 'flex';
        
        // Определяем роль на основе тарифа
        const isAdmin = this.currentUser.role === 'admin' || 
                       this.currentUser.tarif === 'Администратор' || 
                       this.currentUser.group === 'Администраторы';
        
        if (isAdmin) {
            this.showScreen('admin-panel');
            this.loadAdminSurveys();
            this.updateStats();
        } else {
            this.showScreen('student-panel');
            this.loadAvailableSurveys();
        }
    }

    // Показать экран
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    // Обновление статистики
    updateStats() {
        const totalSurveys = this.surveys.filter(s => s.createdBy === this.currentUser.login).length;
        const activeSurveys = this.surveys.filter(s => s.createdBy === this.currentUser.login && s.isActive).length;
        const totalResponses = this.responses.filter(r => 
            this.surveys.some(s => s.id === r.surveyId && s.createdBy === this.currentUser.login)
        ).length;

        document.getElementById('total-surveys').textContent = totalSurveys;
        document.getElementById('active-surveys').textContent = activeSurveys;
        document.getElementById('total-responses').textContent = totalResponses;
    }

    // Установка фильтра
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Обновление активной кнопки
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`filter-${filter}`).classList.add('active');
        
        this.loadAdminSurveys();
    }

    // Модальное окно создания/редактирования анкеты
    showCreateSurveyModal() {
        this.editingSurveyId = null;
        document.getElementById('modal-title').textContent = 'Создать новую анкету';
        document.getElementById('survey-modal').style.display = 'block';
        document.getElementById('questions-container').innerHTML = '';
        document.getElementById('survey-form').reset();
        document.getElementById('survey-status').value = 'true';
        this.addQuestion();
    }

    showEditSurveyModal(surveyId) {
        this.editingSurveyId = surveyId;
        const survey = this.surveys.find(s => s.id === surveyId);
        
        document.getElementById('modal-title').textContent = 'Редактировать анкету';
        document.getElementById('survey-modal').style.display = 'block';
        
        // Заполнение данных анкеты
        document.getElementById('survey-title').value = survey.title;
        document.getElementById('survey-description').value = survey.description || '';
        document.getElementById('survey-status').value = survey.isActive.toString();
        
        // Очистка и заполнение вопросов
        document.getElementById('questions-container').innerHTML = '';
        survey.questions.forEach((question, index) => {
            this.addQuestion(question);
        });
        this.updateQuestionNumbers();
    }

    hideSurveyModal() {
        document.getElementById('survey-modal').style.display = 'none';
        document.getElementById('survey-form').reset();
        this.editingSurveyId = null;
    }

    // Модальное окно экспорта
    showExportModal(cardElement) {
        this.exportSurveyId = parseInt(cardElement.dataset.surveyId);
        document.getElementById('export-modal').style.display = 'block';
    }

    hideExportModal() {
        document.getElementById('export-modal').style.display = 'none';
        this.exportSurveyId = null;
    }

    // Добавление вопроса
    addQuestion(questionData = null) {
        const template = document.getElementById('question-template');
        const questionElement = template.content.cloneNode(true);
        const questionCard = questionElement.querySelector('.question-card');
        
        if (questionData) {
            questionCard.querySelector('.question-text').value = questionData.text;
            questionCard.querySelector('.question-type').value = questionData.type;
            
            if (questionData.options && questionData.options.length > 0) {
                const optionsContainer = questionCard.querySelector('.options-container');
                optionsContainer.style.display = 'block';
                
                // Устанавливаем настройку исчезающих вариантов
                if (questionData.disappearingOptions) {
                    optionsContainer.querySelector('.disappearing-options').checked = true;
                }
                
                questionData.options.forEach(option => {
                    this.addOption(optionsContainer, option.text || option, questionData);
                });
            }
        }
        
        document.getElementById('questions-container').appendChild(questionElement);
        this.updateQuestionNumbers();
    }

    // Обновление нумерации вопросов
    updateQuestionNumbers() {
        document.querySelectorAll('.question-card').forEach((card, index) => {
            card.querySelector('.question-number').textContent = index + 1;
        });
    }

    // Добавление варианта ответа
    addOption(container, value = '', questionData = null) {
        const template = document.getElementById('option-template');
        const optionElement = template.content.cloneNode(true);
        const optionInput = optionElement.querySelector('.option-input');
        const optionStatus = optionElement.querySelector('.option-status');
        
        if (typeof value === 'object') {
            optionInput.value = value.text;
            if (value.maxSelections !== undefined) {
                optionStatus.style.display = 'flex';
                optionElement.querySelector('.remaining-count').textContent = value.maxSelections;
            }
        } else {
            optionInput.value = value;
        }
        
        // Показываем статус варианта если включены исчезающие варианты
        const disappearingEnabled = container.querySelector('.disappearing-options').checked;
        if (disappearingEnabled) {
            optionStatus.style.display = 'flex';
        }
        
        container.querySelector('.options-list').appendChild(optionElement);
    }

    // Переключение отображения вариантов ответов
    toggleOptions(selectElement) {
        const optionsContainer = selectElement.closest('.question-card').querySelector('.options-container');
        if (selectElement.value === 'radio' || selectElement.value === 'checkbox') {
            optionsContainer.style.display = 'block';
            // Добавляем один вариант по умолчанию если их нет
            if (optionsContainer.querySelectorAll('.option-item').length === 0) {
                this.addOption(optionsContainer);
            }
        } else {
            optionsContainer.style.display = 'none';
        }
    }

    // Сохранение анкеты (создание или редактирование)
    handleSaveSurvey(e) {
        e.preventDefault();
        
        const title = document.getElementById('survey-title').value;
        const description = document.getElementById('survey-description').value;
        const isActive = document.getElementById('survey-status').value === 'true';
        
        const questions = [];
        document.querySelectorAll('.question-card').forEach(card => {
            const questionText = card.querySelector('.question-text').value;
            const questionType = card.querySelector('.question-type').value;
            const disappearingOptions = card.querySelector('.disappearing-options')?.checked || false;
            
            const question = {
                id: Date.now() + Math.random(),
                text: questionText,
                type: questionType,
                disappearingOptions: disappearingOptions,
                options: []
            };
            
            if (questionType === 'radio' || questionType === 'checkbox') {
                card.querySelectorAll('.option-item').forEach(optionItem => {
                    const optionText = optionItem.querySelector('.option-input').value;
                    if (optionText.trim()) {
                        const option = {
                            text: optionText.trim(),
                            maxSelections: disappearingOptions ? 1 : Infinity
                        };
                        question.options.push(option);
                    }
                });
            }
            
            questions.push(question);
        });

        if (this.editingSurveyId) {
            // Редактирование существующей анкеты
            const surveyIndex = this.surveys.findIndex(s => s.id === this.editingSurveyId);
            this.surveys[surveyIndex] = {
                ...this.surveys[surveyIndex],
                title,
                description,
                questions,
                isActive
            };
        } else {
            // Создание новой анкеты
            const survey = {
                id: Date.now(),
                title: title,
                description: description,
                questions: questions,
                createdBy: this.currentUser.login,
                createdByFullName: this.currentUser.fullname,
                createdAt: new Date().toISOString(),
                isActive: isActive,
                responses: []
            };
            this.surveys.push(survey);
        }

        this.saveSurveys();
        this.hideSurveyModal();
        this.loadAdminSurveys();
        this.updateStats();
        
        this.showNotification(
            this.editingSurveyId ? 'Анкета успешно обновлена!' : 'Анкета успешно создана!',
            'success'
        );
    }

    // Загрузка анкет для администратора
    loadAdminSurveys() {
        const container = document.getElementById('surveys-container');
        const template = document.getElementById('survey-card-template');
        
        container.innerHTML = '';
        
        let adminSurveys = this.surveys.filter(s => s.createdBy === this.currentUser.login);
        
        // Применение фильтра
        if (this.currentFilter === 'active') {
            adminSurveys = adminSurveys.filter(s => s.isActive);
        } else if (this.currentFilter === 'inactive') {
            adminSurveys = adminSurveys.filter(s => !s.isActive);
        }
        
        adminSurveys.forEach(survey => {
            const card = template.content.cloneNode(true);
            const responsesCount = this.responses.filter(r => r.surveyId === survey.id).length;
            
            card.querySelector('.survey-title').textContent = survey.title;
            card.querySelector('.survey-description').textContent = survey.description || 'Описание отсутствует';
            card.querySelector('.questions-count').textContent = survey.questions.length;
            card.querySelector('.responses-count').textContent = responsesCount;
            card.querySelector('.created-date').textContent = new Date(survey.createdAt).toLocaleDateString();
            
            // Статус анкеты
            const statusBadge = card.querySelector('.survey-status-badge');
            if (survey.isActive) {
                statusBadge.classList.add('active');
                statusBadge.title = 'Активна';
            } else {
                statusBadge.classList.add('inactive');
                statusBadge.title = 'Неактивна';
            }
            
            card.querySelector('.survey-card').dataset.surveyId = survey.id;
            
            container.appendChild(card);
        });
    }

    // Загрузка доступных анкет для учеников
    loadAvailableSurveys() {
        const container = document.getElementById('available-surveys');
        const template = document.getElementById('survey-card-template');
        
        container.innerHTML = '';
        
        const availableSurveys = this.surveys.filter(s => s.isActive);
        
        availableSurveys.forEach(survey => {
            const card = template.content.cloneNode(true);
            const hasResponded = this.responses.some(r => 
                r.surveyId === survey.id && r.student === this.currentUser.login
            );
            
            card.querySelector('.survey-title').textContent = survey.title;
            card.querySelector('.survey-description').textContent = survey.description || 'Описание отсутствует';
            card.querySelector('.questions-count').textContent = survey.questions.length;
            card.querySelector('.responses-count').textContent = this.responses.filter(r => r.surveyId === survey.id).length;
            card.querySelector('.created-date').textContent = new Date(survey.createdAt).toLocaleDateString();
            
            // Статус анкеты
            const statusBadge = card.querySelector('.survey-status-badge');
            if (hasResponded) {
                statusBadge.classList.add('inactive');
                statusBadge.title = 'Пройдена';
            } else {
                statusBadge.classList.add('active');
                statusBadge.title = 'Доступна';
            }
            
            // Убираем dropdown меню для учеников
            card.querySelector('.survey-actions-dropdown').remove();
            
            // Добавляем кнопку для прохождения анкеты
            if (!hasResponded) {
                const takeSurveyBtn = document.createElement('button');
                takeSurveyBtn.className = 'btn-primary';
                takeSurveyBtn.innerHTML = '<i class="fas fa-play"></i> Пройти анкету';
                takeSurveyBtn.addEventListener('click', () => this.takeSurvey(survey.id));
                card.querySelector('.survey-footer').appendChild(takeSurveyBtn);
            }
            
            container.appendChild(card);
        });
    }

    // Получение оставшихся выборов для вариантов ответов
    getRemainingSelections(surveyId, questionId, optionText) {
        const responses = this.responses.filter(r => r.surveyId === surveyId);
        let selectedCount = 0;
        
        responses.forEach(response => {
            const answer = response.answers.find(a => a.questionId === questionId);
            if (answer) {
                if (Array.isArray(answer.value)) {
                    if (answer.value.includes(optionText)) {
                        selectedCount++;
                    }
                } else if (answer.value === optionText) {
                    selectedCount++;
                }
            }
        });
        
        return selectedCount;
    }

    // Копирование ссылки на анкету
    copySurveyLink(cardElement) {
        const surveyId = cardElement.dataset.surveyId;
        const surveyLink = `${window.location.origin}${window.location.pathname}?survey=${surveyId}`;
        
        navigator.clipboard.writeText(surveyLink).then(() => {
            this.showNotification('Ссылка скопирована в буфер обмена!', 'success');
        }).catch(() => {
            // Fallback для старых браузеров
            const textarea = document.createElement('textarea');
            textarea.value = surveyLink;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showNotification('Ссылка скопирована в буфер обмена!', 'success');
        });
    }

    // Показать уведомление
    showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'warning' ? 'exclamation-triangle' : type === 'error' ? 'times' : 'info'}-circle"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Редактирование анкеты
    editSurvey(cardElement) {
        const surveyId = parseInt(cardElement.dataset.surveyId);
        this.showEditSurveyModal(surveyId);
    }

    // Переключение статуса анкеты
    toggleSurveyStatus(cardElement) {
        const surveyId = parseInt(cardElement.dataset.surveyId);
        const survey = this.surveys.find(s => s.id === surveyId);
        
        survey.isActive = !survey.isActive;
        this.saveSurveys();
        this.loadAdminSurveys();
        this.updateStats();
        
        this.showNotification(
            `Анкета "${survey.title}" ${survey.isActive ? 'активирована' : 'деактивирована'}`,
            'success'
        );
    }

    // Просмотр результатов
    viewResults(cardElement) {
        const surveyId = parseInt(cardElement.dataset.surveyId);
        const survey = this.surveys.find(s => s.id === surveyId);
        const surveyResponses = this.responses.filter(r => r.surveyId === surveyId);
        
        let resultsHTML = `
            <div class="results-header">
                <h3><i class="fas fa-chart-bar"></i> Результаты: "${survey.title}"</h3>
                <div class="results-actions">
                    <button class="btn-primary" onclick="app.showExportModal(this.closest('.results-container').querySelector('.survey-card'))">
                        <i class="fas fa-file-export"></i> Экспорт результатов
                    </button>
                    <button class="btn-secondary" onclick="app.showScreen('admin-panel')">
                        <i class="fas fa-arrow-left"></i> Назад
                    </button>
                </div>
            </div>
            <div class="results-stats">
                <div class="stat-badge">
                    <i class="fas fa-users"></i>
                    <span>Всего ответов: <strong>${surveyResponses.length}</strong></span>
                </div>
                <div class="stat-badge">
                    <i class="fas fa-calendar"></i>
                    <span>Создана: <strong>${new Date(survey.createdAt).toLocaleDateString()}</strong></span>
                </div>
                <div class="stat-badge">
                    <i class="fas fa-question-circle"></i>
                    <span>Вопросов: <strong>${survey.questions.length}</strong></span>
                </div>
            </div>
            <div class="results-table-container">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Ученик</th>
                            <th>Дата прохождения</th>
        `;
        
        survey.questions.forEach((question, index) => {
            resultsHTML += `<th>Вопрос ${index + 1}</th>`;
        });
        
        resultsHTML += `</tr></thead><tbody>`;
        
        if (surveyResponses.length === 0) {
            resultsHTML += `
                <tr>
                    <td colspan="${survey.questions.length + 2}" class="no-data">
                        <i class="fas fa-inbox"></i>
                        <span>Нет данных для отображения</span>
                    </td>
                </tr>
            `;
        } else {
            surveyResponses.forEach(response => {
                resultsHTML += `
                    <tr>
                        <td><strong>${response.studentName}</strong></td>
                        <td>${new Date(response.submittedAt).toLocaleString()}</td>
                `;
                
                survey.questions.forEach(question => {
                    const answer = response.answers.find(a => a.questionId === question.id);
                    resultsHTML += `<td>${answer ? this.formatAnswer(answer) : '-'}</td>`;
                });
                
                resultsHTML += `</tr>`;
            });
        }
        
        resultsHTML += `</tbody></table></div>`;
        
        // Добавляем скрытую карточку для экспорта
        resultsHTML += `
            <div class="survey-card" data-survey-id="${surveyId}" style="display: none;">
                ${survey.title}
            </div>
        `;
        
        document.getElementById('results-content').innerHTML = resultsHTML;
        this.showScreen('results-screen');
    }

    // Форматирование ответа для отображения
    formatAnswer(answer) {
        if (Array.isArray(answer.value)) {
            return answer.value.join(', ');
        }
        return answer.value || '-';
    }

    // Обработка экспорта
    handleExport() {
        if (!this.exportSurveyId) return;
        
        const survey = this.surveys.find(s => s.id === this.exportSurveyId);
        const surveyResponses = this.responses.filter(r => r.surveyId === this.exportSurveyId);
        
        const exportFormat = document.querySelector('input[name="export-format"]:checked').value;
        const includeTimestamps = document.getElementById('include-timestamps').checked;
        const includeQuestions = document.getElementById('include-questions').checked;
        
        if (exportFormat === 'excel') {
            this.exportToExcel(survey, surveyResponses, includeTimestamps, includeQuestions);
        } else {
            this.exportToCSV(survey, surveyResponses, includeTimestamps, includeQuestions);
        }
        
        this.hideExportModal();
    }

    // Экспорт в Excel
    exportToExcel(survey, responses, includeTimestamps, includeQuestions) {
        try {
            // Создаем рабочую книгу
            const wb = XLSX.utils.book_new();
            
            // Подготавливаем данные
            const data = [];
            
            // Заголовок
            const header = ['ФИО ученика'];
            if (includeTimestamps) {
                header.push('Дата и время прохождения');
            }
            
            if (includeQuestions) {
                survey.questions.forEach((question, index) => {
                    header.push(`Вопрос ${index + 1}: ${question.text}`);
                });
            } else {
                survey.questions.forEach((question, index) => {
                    header.push(`Вопрос ${index + 1}`);
                });
            }
            
            data.push(header);
            
            // Данные
            responses.forEach(response => {
                const row = [response.studentName];
                
                if (includeTimestamps) {
                    row.push(new Date(response.submittedAt).toLocaleString());
                }
                
                survey.questions.forEach(question => {
                    const answer = response.answers.find(a => a.questionId === question.id);
                    let answerText = '-';
                    
                    if (answer) {
                        if (Array.isArray(answer.value)) {
                            answerText = answer.value.join('; ');
                        } else {
                            answerText = answer.value;
                        }
                    }
                    
                    row.push(answerText);
                });
                
                data.push(row);
            });
            
            // Создаем рабочий лист
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // Настраиваем ширину колонок
            const colWidths = [];
            header.forEach((_, index) => {
                colWidths.push({ wch: 20 });
            });
            ws['!cols'] = colWidths;
            
            // Добавляем лист в книгу
            XLSX.utils.book_append_sheet(wb, ws, 'Результаты анкеты');
            
            // Создаем лист с информацией об анкете
            const infoData = [
                ['Информация об анкете'],
                ['Название:', survey.title],
                ['Описание:', survey.description || 'Не указано'],
                ['Автор:', survey.createdByFullName || survey.createdBy],
                ['Дата создания:', new Date(survey.createdAt).toLocaleDateString()],
                ['Всего ответов:', responses.length],
                [''],
                ['Вопросы:']
            ];
            
            survey.questions.forEach((question, index) => {
                infoData.push([`Вопрос ${index + 1}:`, question.text]);
                infoData.push(['Тип:', this.getQuestionTypeName(question.type)]);
                if (question.disappearingOptions) {
                    infoData.push(['Исчезающие варианты:', 'Да']);
                }
                if (question.options.length > 0) {
                    infoData.push(['Варианты ответов:', question.options.map(opt => opt.text).join('; ')]);
                    if (question.disappearingOptions) {
                        infoData.push(['Осталось выборов:', question.options.map(opt => {
                            const selected = this.getRemainingSelections(survey.id, question.id, opt.text);
                            return `${opt.text}: ${Math.max(0, opt.maxSelections - selected)} из ${opt.maxSelections}`;
                        }).join('; ')]);
                    }
                }
                infoData.push(['']);
            });
            
            const infoWs = XLSX.utils.aoa_to_sheet(infoData);
            infoWs['!cols'] = [{ wch: 20 }, { wch: 50 }];
            XLSX.utils.book_append_sheet(wb, infoWs, 'Информация');
            
            // Генерируем файл
            const fileName = `Результаты_${survey.title.replace(/[^\wа-яА-ЯёЁ\s]/gi, '')}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            this.showNotification('Результаты успешно экспортированы в Excel!', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте в Excel:', error);
            this.showNotification('Ошибка при экспорте в Excel', 'error');
        }
    }

    // Экспорт в CSV
    exportToCSV(survey, responses, includeTimestamps, includeQuestions) {
        try {
            let csv = '';
            
            // Заголовок
            csv += 'ФИО ученика';
            if (includeTimestamps) {
                csv += ',Дата и время прохождения';
            }
            
            if (includeQuestions) {
                survey.questions.forEach((question, index) => {
                    csv += `,"Вопрос ${index + 1}: ${question.text}"`;
                });
            } else {
                survey.questions.forEach((question, index) => {
                    csv += `,Вопрос ${index + 1}`;
                });
            }
            csv += '\n';
            
            // Данные
            responses.forEach(response => {
                csv += `"${response.studentName}"`;
                
                if (includeTimestamps) {
                    csv += `,"${new Date(response.submittedAt).toLocaleString()}"`;
                }
                
                survey.questions.forEach(question => {
                    const answer = response.answers.find(a => a.questionId === question.id);
                    let answerText = '-';
                    
                    if (answer) {
                        if (Array.isArray(answer.value)) {
                            answerText = answer.value.join('; ');
                        } else {
                            answerText = answer.value;
                        }
                    }
                    
                    csv += `,"${answerText.replace(/"/g, '""')}"`;
                });
                
                csv += '\n';
            });
            
            // Создаем и скачиваем файл
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Результаты_${survey.title.replace(/[^\wа-яА-ЯёЁ\s]/gi, '')}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Результаты успешно экспортированы в CSV!', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте в CSV:', error);
            this.showNotification('Ошибка при экспорте в CSV', 'error');
        }
    }

    // Получить название типа вопроса
    getQuestionTypeName(type) {
        const types = {
            'text': 'Текстовый ответ',
            'radio': 'Один вариант',
            'checkbox': 'Несколько вариантов'
        };
        return types[type] || type;
    }

    // Прохождение анкеты
    takeSurvey(surveyId) {
        const survey = this.surveys.find(s => s.id === surveyId);
        this.currentSurvey = survey;
        
        let surveyHTML = `
            <div class="survey-header">
                <h3>${survey.title}</h3>
                <p class="survey-description">${survey.description || ''}</p>
            </div>
            <form id="take-survey-form" class="take-survey-form">
        `;
        
        survey.questions.forEach((question, index) => {
            surveyHTML += `
                <div class="survey-question">
                    <div class="question-header">
                        <h4>${index + 1}. ${question.text}</h4>
                        ${question.type !== 'text' ? `<span class="question-hint">${question.type === 'radio' ? 'Выберите один вариант' : 'Выберите один или несколько вариантов'}</span>` : ''}
                    </div>
                    <div class="question-options">
            `;
            
            if (question.type === 'text') {
                surveyHTML += `
                    <textarea name="question_${question.id}" rows="3" placeholder="Введите ваш ответ..." required></textarea>
                `;
            } else if (question.type === 'radio' || question.type === 'checkbox') {
                // Проверяем доступные варианты
                question.options.forEach(option => {
                    const selectedCount = this.getRemainingSelections(surveyId, question.id, option.text);
                    const isExhausted = question.disappearingOptions && selectedCount >= option.maxSelections;
                    const remaining = option.maxSelections - selectedCount;
                    
                    const disabledAttr = isExhausted ? 'disabled' : '';
                    const disabledClass = isExhausted ? 'disabled' : '';
                    
                    if (question.type === 'radio') {
                        surveyHTML += `
                            <label class="option-label ${disabledClass}">
                                <input type="radio" name="question_${question.id}" value="${option.text}" ${disabledAttr} ${!isExhausted ? 'required' : ''}>
                                <span class="option-text">${option.text}</span>
                                ${question.disappearingOptions ? `<span class="remaining-badge">Осталось: ${Math.max(0, remaining)}</span>` : ''}
                            </label>
                        `;
                    } else {
                        surveyHTML += `
                            <label class="option-label ${disabledClass}">
                                <input type="checkbox" name="question_${question.id}" value="${option.text}" ${disabledAttr}>
                                <span class="option-text">${option.text}</span>
                                ${question.disappearingOptions ? `<span class="remaining-badge">Осталось: ${Math.max(0, remaining)}</span>` : ''}
                            </label>
                        `;
                    }
                });
            }
            
            surveyHTML += `</div></div>`;
        });
        
        surveyHTML += `
            <div class="survey-actions">
                <button type="submit" class="btn-primary">
                    <i class="fas fa-paper-plane"></i>
                    Отправить ответы
                </button>
                <button type="button" class="btn-secondary" onclick="app.showScreen('student-panel')">
                    <i class="fas fa-arrow-left"></i>
                    Назад
                </button>
            </div>
            </form>
        `;
        
        document.getElementById('survey-content').innerHTML = surveyHTML;
        
        // Добавляем CSS для бейджей
        const style = document.createElement('style');
        style.textContent = `
            .remaining-badge {
                font-size: 0.75rem;
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                background: var(--light);
                color: var(--gray);
                margin-left: auto;
            }
            
            .option-label.disabled .remaining-badge {
                background: var(--danger);
                color: white;
            }
            
            .option-label:not(.disabled) .remaining-badge {
                background: var(--success);
                color: white;
            }
        `;
        document.head.appendChild(style);
        
        document.getElementById('take-survey-form').addEventListener('submit', (e) => this.handleSurveySubmit(e, surveyId));
        this.showScreen('survey-screen');
    }

    // Обработка отправки анкеты
    handleSurveySubmit(e, surveyId) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const answers = [];
        
        // Проверяем, что все обязательные поля заполнены
        let hasError = false;
        
        this.currentSurvey.questions.forEach(question => {
            if (question.type === 'radio') {
                const selectedOption = formData.get(`question_${question.id}`);
                if (!selectedOption && question.options.some(opt => !this.getRemainingSelections(surveyId, question.id, opt.text))) {
                    this.showNotification(`Выберите вариант для вопроса "${question.text}"`, 'error');
                    hasError = true;
                }
            }
        });
        
        if (hasError) return;
        
        this.currentSurvey.questions.forEach(question => {
            if (question.type === 'checkbox') {
                const selectedOptions = [];
                document.querySelectorAll(`input[name="question_${question.id}"]:checked`).forEach(checkbox => {
                    selectedOptions.push(checkbox.value);
                });
                
                // Проверяем исчерпание вариантов
                if (question.disappearingOptions) {
                    const unavailableOptions = [];
                    selectedOptions.forEach(optionText => {
                        const selectedCount = this.getRemainingSelections(surveyId, question.id, optionText);
                        const option = question.options.find(opt => opt.text === optionText);
                        if (option && selectedCount >= option.maxSelections) {
                            unavailableOptions.push(optionText);
                        }
                    });
                    
                    if (unavailableOptions.length > 0) {
                        this.showNotification(`Некоторые выбранные варианты уже недоступны: ${unavailableOptions.join(', ')}`, 'error');
                        hasError = true;
                        return;
                    }
                }
                
                answers.push({
                    questionId: question.id,
                    value: selectedOptions
                });
            } else if (question.type === 'radio') {
                const selectedOption = formData.get(`question_${question.id}`);
                if (selectedOption) {
                    // Проверяем исчерпание варианта
                    if (question.disappearingOptions) {
                        const selectedCount = this.getRemainingSelections(surveyId, question.id, selectedOption);
                        const option = question.options.find(opt => opt.text === selectedOption);
                        if (option && selectedCount >= option.maxSelections) {
                            this.showNotification(`Выбранный вариант "${selectedOption}" уже недоступен`, 'error');
                            hasError = true;
                            return;
                        }
                    }
                    
                    answers.push({
                        questionId: question.id,
                        value: selectedOption
                    });
                }
            } else {
                const textValue = formData.get(`question_${question.id}`);
                if (!textValue || !textValue.trim()) {
                    this.showNotification(`Заполните текстовое поле для вопроса "${question.text}"`, 'error');
                    hasError = true;
                    return;
                }
                answers.push({
                    questionId: question.id,
                    value: textValue
                });
            }
        });
        
        if (hasError || answers.length !== this.currentSurvey.questions.length) {
            return;
        }
        
        const response = {
            id: Date.now(),
            surveyId: surveyId,
            student: this.currentUser.login,
            studentName: this.currentUser.fullname,
            answers: answers,
            submittedAt: new Date().toISOString()
        };
        
        this.responses.push(response);
        this.saveResponses();
        
        this.showNotification('Спасибо за участие в анкетировании!', 'success');
        setTimeout(() => {
            this.showScreen('student-panel');
            this.loadAvailableSurveys();
        }, 1500);
    }

    // Удаление анкеты
    deleteSurvey(cardElement) {
        const surveyId = parseInt(cardElement.dataset.surveyId);
        const survey = this.surveys.find(s => s.id === surveyId);
        
        if (!confirm(`Вы уверены, что хотите удалить анкету "${survey.title}"?`)) return;
        
        this.surveys = this.surveys.filter(s => s.id !== surveyId);
        this.responses = this.responses.filter(r => r.surveyId !== surveyId);
        
        this.saveSurveys();
        this.saveResponses();
        this.loadAdminSurveys();
        this.updateStats();
        
        this.showNotification('Анкета успешно удалена!', 'success');
    }

    // Сохранение данных
    saveSurveys() {
        localStorage.setItem('surveys', JSON.stringify(this.surveys));
    }

    saveResponses() {
        localStorage.setItem('responses', JSON.stringify(this.responses));
    }
}

// Инициализация приложения
const app = new SurveyApp();

// Обработка ссылок на анкеты
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('survey');
    
    if (surveyId && app.currentUser && app.currentUser.role === 'student') {
        const survey = app.surveys.find(s => s.id === parseInt(surveyId));
        if (survey && survey.isActive) {
            const hasResponded = app.responses.some(r => 
                r.surveyId === survey.id && r.student === app.currentUser.login
            );
            
            if (!hasResponded) {
                app.takeSurvey(survey.id);
            }
        }
    }
});

// Добавляем обработку сетевых ошибок
window.addEventListener('offline', () => {
    app.showNotification('Нет подключения к интернету', 'error');
});

window.addEventListener('online', () => {
    app.showNotification('Подключение восстановлено', 'success');
});

// Глобальная обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
});

// Добавляем стили для демо-режима
const style = document.createElement('style');
style.textContent = `
    .demo-badge {
        background: var(--warning);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.7rem;
        margin-left: 0.5rem;
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);