document.addEventListener('DOMContentLoaded', async () => {
    // Set dynamic version in title
    const manifest = chrome.runtime.getManifest();
    const titleElement = document.querySelector('h1');
    if (titleElement && manifest && manifest.version) {
        titleElement.textContent = `Navigation Simulator v${manifest.version}`;
    }

    let currentTabId = null;

    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        currentTabId = tabs[0].id;
    } else {
        return;
    }


    const stepsContainer = document.getElementById('steps-container');
    const addStepBtn = document.getElementById('add-step-btn');
    const startStopBtn = document.getElementById('start-stop-btn');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const saveMsg = document.getElementById('save-msg');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const iterationContainer = document.getElementById('iteration-container');
    const iterationCount = document.getElementById('iteration-count');

    const template = document.getElementById('step-template').content;
    const monitorInputTemplate = document.getElementById('monitor-input-template').content;

    const monitorActive = document.getElementById('monitor-active');
    const monitorConfigSection = document.getElementById('monitor-config-section');
    const monitorUrl = document.getElementById('monitor-url');
    const monitorInputsContainer = document.getElementById('monitor-inputs-container');
    const addMonitorInputBtn = document.getElementById('add-monitor-input-btn');

    // Load config for this tab
    const data = await chrome.storage.local.get(['tabConfigs']);
    const configs = data.tabConfigs || {};
    const config = configs[currentTabId] || {
        active: false,
        monitor: { active: false, url: '', inputs: [] },
        steps: []
    };

    // Initialize UI
    let isActive = config.active;

    
    // Load initial stats
    const statsData = await chrome.storage.local.get(['tabStats']);
    const stats = statsData.tabStats || {};
    if (stats[currentTabId]) {
        iterationCount.textContent = stats[currentTabId].iterations;
    }
    
    updateStatusUI();

    config.steps.forEach(step => addStepUI(step));
    if (config.steps.length === 0) {
        addStepUI();
    }

    // Initialize Monitor UI
    monitorActive.checked = config.monitor?.active || false;
    monitorUrl.value = config.monitor?.url || '';
    updateMonitorVisibility();
    
    const savedMonitorInputs = config.monitor?.inputs || [];
    savedMonitorInputs.forEach(input => addMonitorInputUI(input.selector, input.value, input.isPassword));
    if (savedMonitorInputs.length === 0) {
        addMonitorInputUI();
    }
    
    monitorActive.addEventListener('change', updateMonitorVisibility);
    addMonitorInputBtn.addEventListener('click', () => addMonitorInputUI());

    function updateMonitorVisibility() {
        if (monitorActive.checked) {
            monitorConfigSection.classList.remove('hidden');
        } else {
            monitorConfigSection.classList.add('hidden');
        }
    }

    function addMonitorInputUI(selector = '', value = '', isPassword = false) {
        const clone = document.importNode(monitorInputTemplate, true);
        const row = clone.querySelector('.monitor-input-row');
        row.querySelector('.monitor-selector').value = selector;
        
        const valueInput = row.querySelector('.monitor-value');
        valueInput.value = value;
        
        const pwdCheckbox = row.querySelector('.monitor-is-password');
        pwdCheckbox.checked = isPassword;
        valueInput.type = isPassword ? 'password' : 'text';
        
        pwdCheckbox.addEventListener('change', (e) => {
            valueInput.type = e.target.checked ? 'password' : 'text';
        });
        
        row.querySelector('.delete-monitor-input').addEventListener('click', () => {
            row.remove();
        });
        
        monitorInputsContainer.appendChild(clone);
    }

    // Listen for stats updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.tabStats) {
            const newStats = changes.tabStats.newValue || {};
            if (newStats[currentTabId] !== undefined) {
                iterationCount.textContent = newStats[currentTabId].iterations;
            }
        }
    });

    // Event Listeners
    addStepBtn.addEventListener('click', () => addStepUI());
    
    async function saveCurrentConfig() {
        const steps = [];
        const stepCards = stepsContainer.querySelectorAll('.step-card');
        
        for (const card of stepCards) {
            const url = card.querySelector('.step-url').value.trim();
            const method = card.querySelector('.step-method').value;
            const delay = parseFloat(card.querySelector('.step-delay').value) || 0;
            const body = card.querySelector('.step-body').value;
            
            if (url) {
                steps.push({ url, method, delay, body });
            }
        }

        const monitorInputs = [];
        const monitorRows = monitorInputsContainer.querySelectorAll('.monitor-input-row');
        for (const row of monitorRows) {
            const selector = row.querySelector('.monitor-selector').value.trim();
            const value = row.querySelector('.monitor-value').value;
            const isPassword = row.querySelector('.monitor-is-password').checked;
            if (selector) {
                monitorInputs.push({ selector, value, isPassword });
            }
        }

        configs[currentTabId] = {
            active: isActive,
            monitor: {
                active: monitorActive.checked,
                url: monitorUrl.value.trim(),
                inputs: monitorInputs
            },
            steps: steps
        };

        await chrome.storage.local.set({ tabConfigs: configs });
        
        saveMsg.textContent = "Configuration saved";
        setTimeout(() => { saveMsg.textContent = ""; }, 2000);
    }

    startStopBtn.addEventListener('click', async () => {
        isActive = !isActive;
        await saveCurrentConfig();
        updateStatusUI();
    });

    saveConfigBtn.addEventListener('click', async () => {
        await saveCurrentConfig();
    });

    function updateStatusUI() {
        if (isActive) {
            statusDot.classList.add('online');
            statusText.textContent = 'Active';
            statusText.className = 'status-text-active';
            startStopBtn.textContent = 'Stop Navigation';
            startStopBtn.className = 'btn-stop';
            iterationContainer.classList.remove('hidden');
        } else {
            statusDot.classList.remove('online');
            statusText.textContent = 'Inactive';
            statusText.className = 'status-text-inactive';
            startStopBtn.textContent = 'Start Navigation';
            startStopBtn.className = 'btn-start';
            iterationContainer.classList.add('hidden');
        }
    }

    function addStepUI(stepData = null) {
        const clone = document.importNode(template, true);
        const card = clone.querySelector('.step-card');
        
        const methodSelect = card.querySelector('.step-method');
        const bodyContainer = card.querySelector('.body-container');
        const deleteBtn = card.querySelector('.delete-step');
        const upBtn = card.querySelector('.move-up');
        const downBtn = card.querySelector('.move-down');

        if (stepData) {
            card.querySelector('.step-url').value = stepData.url || "";
            methodSelect.value = stepData.method || "GET";
            card.querySelector('.step-delay').value = stepData.delay !== undefined ? stepData.delay : 2;
            card.querySelector('.step-body').value = stepData.body || "";
        }

        // Toggle body field based on method
        const updateBodyVisibility = () => {
            if (methodSelect.value === 'POST') {
                bodyContainer.classList.remove('hidden');
            } else {
                bodyContainer.classList.add('hidden');
            }
        };
        methodSelect.addEventListener('change', updateBodyVisibility);
        updateBodyVisibility();

        // Actions
        deleteBtn.addEventListener('click', () => {
            card.remove();
            updateStepNumbers();
        });

        upBtn.addEventListener('click', () => {
            if (card.previousElementSibling) {
                stepsContainer.insertBefore(card, card.previousElementSibling);
                updateStepNumbers();
            }
        });

        downBtn.addEventListener('click', () => {
            if (card.nextElementSibling) {
                stepsContainer.insertBefore(card.nextElementSibling, card);
                updateStepNumbers();
            }
        });

        const useCurrentUrlBtn = card.querySelector('.use-current-url');
        if (useCurrentUrlBtn) {
            useCurrentUrlBtn.addEventListener('click', async () => {
                const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTabs.length > 0 && activeTabs[0].url) {
                    card.querySelector('.step-url').value = activeTabs[0].url;
                }
            });
        }

        stepsContainer.appendChild(clone);
        updateStepNumbers();
    }

    function updateStepNumbers() {
        const cards = stepsContainer.querySelectorAll('.step-card');
        cards.forEach((card, index) => {
            card.querySelector('.step-number').textContent = `Step ${index + 1}`;
        });
    }
});
