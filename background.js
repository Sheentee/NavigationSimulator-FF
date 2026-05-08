let tabStates = {}; // In-memory state tracking { tabId: { currentStep: 0, iterations: 0, isExecuting: false } }

// Load state from storage on startup to recover from process termination
chrome.storage.local.get(['tabSimStates'], (data) => {
    if (data.tabSimStates) {
        tabStates = data.tabSimStates;
        // Reset isExecuting status as any previous execution context is lost on restart
        for (let tabId in tabStates) {
            tabStates[tabId].isExecuting = false;
        }
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.tabConfigs) {
        const oldConfigs = changes.tabConfigs.oldValue || {};
        const newConfigs = changes.tabConfigs.newValue || {};

        for (const tabIdStr in newConfigs) {
            const tabId = parseInt(tabIdStr);
            const newConfig = newConfigs[tabIdStr];
            const oldConfig = oldConfigs[tabIdStr];

            if (newConfig.active && (!oldConfig || !oldConfig.active)) {
                // Activated
                startSimulation(tabId, newConfig);
            } else if (!newConfig.active && oldConfig && oldConfig.active) {
                // Deactivated
                stopSimulation(tabId);
            } else if (newConfig.active) {
                // Config updated while active
                stopSimulation(tabId);
                startSimulation(tabId, newConfig);
            }
        }

        // Handle removals
        for (const tabIdStr in oldConfigs) {
            if (!newConfigs[tabIdStr] || !newConfigs[tabIdStr].active) {
                stopSimulation(parseInt(tabIdStr));
            }
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    stopSimulation(tabId);
    
    // Cleanup config
    chrome.storage.local.get(['tabConfigs'], (data) => {
        if (data.tabConfigs && data.tabConfigs[tabId]) {
            delete data.tabConfigs[tabId];
            chrome.storage.local.set({ tabConfigs: data.tabConfigs });
        }
    });
});

// Handle Alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('simulate_')) {
        const tabId = parseInt(alarm.name.split('_')[1]);
        chrome.storage.local.get(['tabConfigs'], (data) => {
            const configs = data.tabConfigs || {};
            const config = configs[tabId];
            if (config && config.active) {
                executeNextStep(tabId, config);
            }
        });
    }
});

function saveTabStates() {
    chrome.storage.local.set({ tabSimStates: tabStates });
}

function startSimulation(tabId, config) {
    if (!config || !config.steps || config.steps.length === 0) return;
    
    tabStates[tabId] = {
        currentStep: 0,
        iterations: 0,
        isExecuting: false
    };
    
    saveTabStates();
    updateTabStats(tabId, 0);
    
    executeNextStep(tabId, config);
}

function updateTabStats(tabId, iterations) {
    chrome.storage.local.get(['tabStats'], (data) => {
        const stats = data.tabStats || {};
        stats[tabId] = { iterations: iterations };
        chrome.storage.local.set({ tabStats: stats });
    });
}

function stopSimulation(tabId) {
    chrome.alarms.clear(`simulate_${tabId}`);
    if (tabStates[tabId]) {
        delete tabStates[tabId];
        saveTabStates();
    }
}

async function executeNextStep(tabId, config) {
    const state = tabStates[tabId];
    if (!state) return;
    if (state.isExecuting) return; 
    
    // Check if we reached the end
    if (state.currentStep >= config.steps.length) {
        state.currentStep = 0; // Reset
        state.iterations++;
        updateTabStats(tabId, state.iterations);
        saveTabStates();
    }

    state.isExecuting = true;
    saveTabStates();

    const step = config.steps[state.currentStep];

    try {
        if (step.method === 'GET') {
            await new Promise((resolve) => {
                let isResolved = false;
                
                const finish = () => {
                    if (isResolved) return;
                    isResolved = true;
                    chrome.tabs.onUpdated.removeListener(updateListener);
                    chrome.tabs.onRemoved.removeListener(removeListener);
                    resolve();
                };

                const updateListener = (uTabId, info) => {
                    if (uTabId === tabId && info.status === 'complete') {
                        finish();
                    }
                };
                
                const removeListener = (rTabId) => {
                    if (rTabId === tabId) {
                        finish();
                    }
                };

                chrome.tabs.onUpdated.addListener(updateListener);
                chrome.tabs.onRemoved.addListener(removeListener);
                
                chrome.tabs.update(tabId, { url: step.url }).catch((e) => {
                    finish(); 
                });
                
                // Failsafe timeout
                setTimeout(() => { finish(); }, 30000);
            });
        } else if (step.method === 'POST') {
            await new Promise((resolve) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: performFetch,
                    args: [step.url, step.body]
                }, () => {
                    resolve();
                });
            });
        }
    } catch (err) {
        console.error("Step execution error:", err);
    }

    // Prepare for next step
    if (!tabStates[tabId]) return; 
    
    state.isExecuting = false;
    state.currentStep++;
    saveTabStates();
    
    const delayInMinutes = (step.delay || 1) / 60;
    chrome.alarms.create(`simulate_${tabId}`, {
        delayInMinutes: delayInMinutes
    });
}

async function performFetch(url, bodyText) {
    try {
        let options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (bodyText) {
            options.body = bodyText;
        }

        const response = await fetch(url, options);
        return await response.text();
    } catch (e) {
        return e.toString();
    }
}
