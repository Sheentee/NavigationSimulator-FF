let tabStates = {}; // In-memory state tracking { tabId: { currentStep: 0, timerId: null, isExecuting: false } }

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

function startSimulation(tabId, config) {
    if (!config || !config.steps || config.steps.length === 0) return;
    
    tabStates[tabId] = {
        currentStep: 0,
        iterations: 0,
        timerId: null,
        isExecuting: false
    };
    
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
    if (tabStates[tabId]) {
        if (tabStates[tabId].timerId) {
            clearTimeout(tabStates[tabId].timerId);
        }
        delete tabStates[tabId];
    }
}

async function executeNextStep(tabId, config) {
    const state = tabStates[tabId];
    if (!state) return;
    if (state.isExecuting) return; // Prevent concurrent execution
    
    // Check if we reached the end
    if (state.currentStep >= config.steps.length) {
        state.currentStep = 0; // Reset
        state.iterations++;
        updateTabStats(tabId, state.iterations);
        
        state.timerId = setTimeout(() => {
            executeNextStep(tabId, config);
        }, config.loopDelay * 1000);
        return;
    }

    state.isExecuting = true;
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
                    finish(); // Continue even on error
                });
                
                // Failsafe timeout in case the page hangs indefinitely
                setTimeout(() => { finish(); }, 30000);
            });
        } else if (step.method === 'POST') {
            await new Promise((resolve) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: performFetch,
                    args: [step.url, step.body]
                }, () => {
                    // Resolve when fetch is complete
                    resolve();
                });
            });
        }
    } catch (err) {
        console.error("Step execution error:", err);
    }

    // After completion, wait for the step delay
    if (!tabStates[tabId]) return; // Check if stopped during execution
    
    state.isExecuting = false;
    state.currentStep++;
    
    state.timerId = setTimeout(() => {
        executeNextStep(tabId, config);
    }, step.delay * 1000);
}

// This function is injected into the page context
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
