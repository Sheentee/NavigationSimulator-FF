document.addEventListener('DOMContentLoaded', async () => {
    let currentTabId = null;

    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        currentTabId = tabs[0].id;
    } else {
        return;
    }

    const loopDelayInput = document.getElementById('loop-delay');
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

    // Load config for this tab
    const data = await chrome.storage.local.get(['tabConfigs']);
    const configs = data.tabConfigs || {};
    const config = configs[currentTabId] || {
        active: false,
        loopDelay: 5,
        steps: []
    };

    // Initialize UI
    let isActive = config.active;
    loopDelayInput.value = config.loopDelay;
    
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

        configs[currentTabId] = {
            active: isActive,
            loopDelay: parseFloat(loopDelayInput.value) || 0,
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
