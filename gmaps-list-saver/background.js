// Google Maps List Saver - Background Script

let savingState = {
  active: false,
  listName: '',
  places: [],
  currentIndex: 0,
  listCreated: false,
  tabId: null
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action);
  
  if (message.action === 'startSaving') {
    // If tabId is provided (from popup), use it directly
    if (message.tabId) {
      startSavingProcessWithTab(message.listName, message.places, message.tabId);
    } else {
      startSavingProcess(message.listName, message.places);
    }
    sendResponse({ success: true });
  }
  
  if (message.action === 'contentReady') {
    // Content script is ready, proceed with automation
    handleContentReady(sender.tab.id);
  }
  
  if (message.action === 'saveComplete') {
    // One place saved, move to next
    handleSaveComplete();
  }
  
  if (message.action === 'saveError') {
    // Error occurred
    handleSaveError(message.error);
  }
  
  return true; // Keep message channel open
});

// Start saving with a tab that's already been created
const startSavingProcessWithTab = (listName, places, tabId) => {
  savingState = {
    active: true,
    listName,
    places,
    currentIndex: 0,
    listCreated: false,
    tabId: tabId
  };
  
  console.log('🚀 startSavingProcessWithTab called');
  console.log('   listName:', listName);
  console.log('   places:', JSON.stringify(places));
  console.log('   tabId:', tabId);
  
  // Check if tab is already loaded (race condition fix)
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Tab error:', chrome.runtime.lastError);
      notifyPopup('statusUpdate', { message: 'Tab error: ' + chrome.runtime.lastError.message, type: 'error' });
      return;
    }
    
    console.log('📋 Tab status:', tab.status, 'url:', tab.url);
    
    if (tab.status === 'complete') {
      // Tab already loaded, start immediately (with delay for Maps to render)
      console.log('✅ Tab already loaded, will start automation in 4 seconds...');
      notifyPopup('statusUpdate', { message: 'Page loaded, starting in 4s...', type: 'progress' });
      
      setTimeout(() => {
        console.log('⏰ Timer fired, calling injectAndStart...');
        injectAndStart();
      }, 4000);
    } else {
      // Wait for tab to finish loading
      console.log('⏳ Tab not loaded yet (status: ' + tab.status + '), setting up listener...');
      
      const onUpdatedListener = (updatedTabId, info) => {
        console.log('📡 Tab update event:', updatedTabId, info);
        
        if (updatedTabId === tabId && info.status === 'complete') {
          console.log('✅ Page loaded, waiting before injection...');
          chrome.tabs.onUpdated.removeListener(onUpdatedListener);
          notifyPopup('statusUpdate', { message: 'Page loaded, starting automation...', type: 'progress' });
          
          // Wait for Google Maps to fully render
          setTimeout(() => {
            console.log('⏰ Timer fired, calling injectAndStart...');
            injectAndStart();
          }, 4000);
        }
      };
      
      chrome.tabs.onUpdated.addListener(onUpdatedListener);
    }
  });
};

// Start the saving process (legacy - creates its own tab)
const startSavingProcess = async (listName, places) => {
  savingState = {
    active: true,
    listName,
    places,
    currentIndex: 0,
    listCreated: false,
    tabId: null
  };
  
  console.log('Starting save process:', { listName, places });
  
  // Open Google Maps with the first place
  const firstPlace = places[0];
  // Use place name + address for better search results
  const searchQuery = encodeURIComponent(
    firstPlace.address 
      ? `${firstPlace.name}, ${firstPlace.address}` 
      : firstPlace.name
  );
  const url = `https://www.google.com/maps/search/${searchQuery}`;
  
  try {
    // Always create a new tab - simpler and more reliable
    console.log('Creating new tab with URL:', url);
    
    chrome.tabs.create({ url: url }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Tab create error:', chrome.runtime.lastError);
        notifyPopup('statusUpdate', { message: chrome.runtime.lastError.message, type: 'error' });
        return;
      }
      
      console.log('Tab created:', tab.id);
      savingState.tabId = tab.id;
      
      // Set up listener for when page loads
      const onUpdatedListener = (tabId, info, tabInfo) => {
        if (tabId === savingState.tabId && info.status === 'complete') {
          console.log('Page loaded, waiting before injection...');
          chrome.tabs.onUpdated.removeListener(onUpdatedListener);
          
          // Wait for Google Maps to fully render
          setTimeout(() => {
            injectAndStart();
          }, 3000);
        }
      };
      
      chrome.tabs.onUpdated.addListener(onUpdatedListener);
    });
    
  } catch (error) {
    console.error('Error starting process:', error);
    notifyPopup('statusUpdate', { message: error.message, type: 'error' });
  }
};

// Inject content script and start automation
let injectRetries = 0;
const MAX_RETRIES = 5;

const injectAndStart = async () => {
  console.log('injectAndStart called, tabId:', savingState.tabId, 'retry:', injectRetries);
  
  if (!savingState.tabId) {
    console.error('No tabId available!');
    return;
  }
  
  const place = savingState.places[savingState.currentIndex];
  console.log('Sending automation command for place:', place.name);
  
  // Always re-inject the content script (Google Maps SPA loses the script on navigation)
  try {
    console.log('Injecting content script...');
    await chrome.scripting.executeScript({
      target: { tabId: savingState.tabId },
      files: ['content.js']
    });
    console.log('Content script injected');
    await new Promise(r => setTimeout(r, 1000)); // Wait for script to initialize
  } catch (injectError) {
    console.log('Content script injection error:', injectError.message);
  }
  
  // First, ping the content script to make sure it's responsive
  try {
    console.log('Pinging content script...');
    const pingResponse = await chrome.tabs.sendMessage(savingState.tabId, { action: 'ping' });
    console.log('Ping response:', pingResponse);
  } catch (pingError) {
    console.log('Ping failed, will retry:', pingError.message);
    
    if (injectRetries < MAX_RETRIES) {
      injectRetries++;
      console.log(`Content script not ready, retrying in 2 seconds... (attempt ${injectRetries}/${MAX_RETRIES})`);
      setTimeout(() => injectAndStart(), 2000);
      return;
    }
  }
  
  // Now send the automation command
  try {
    console.log('Sending startAutomation message...');
    const response = await chrome.tabs.sendMessage(savingState.tabId, {
      action: 'startAutomation',
      place: place,
      listName: savingState.listName,
      isFirstPlace: savingState.currentIndex === 0,
      totalPlaces: savingState.places.length,
      currentIndex: savingState.currentIndex
    });
    console.log('Message sent successfully, response:', response);
    injectRetries = 0; // Reset on success
    notifyPopup('statusUpdate', { message: `Automating save for "${place.name}"...`, type: 'progress' });
  } catch (error) {
    console.error('Error sending message to content:', error);
    
    if (injectRetries < MAX_RETRIES) {
      injectRetries++;
      console.log(`Retrying in 2 seconds... (attempt ${injectRetries}/${MAX_RETRIES})`);
      setTimeout(() => injectAndStart(), 2000);
    } else {
      console.error('Max retries reached, giving up');
      notifyPopup('statusUpdate', { 
        message: 'Failed to communicate with page. Try refreshing and clicking Save again.', 
        type: 'error' 
      });
      injectRetries = 0;
    }
  }
};

// Handle when content script reports ready
const handleContentReady = (tabId) => {
  if (tabId === savingState.tabId) {
    injectAndStart();
  }
};

// Handle successful save of one place
const handleSaveComplete = () => {
  savingState.currentIndex++;
  
  if (savingState.currentIndex >= savingState.places.length) {
    // All done!
    savingState.active = false;
    notifyPopup('savingComplete', {
      count: savingState.places.length,
      listName: savingState.listName
    });
    return;
  }
  
  // Move to next place
  const nextPlace = savingState.places[savingState.currentIndex];
  // Use place name + address for better search results
  const searchQuery = encodeURIComponent(
    nextPlace.address 
      ? `${nextPlace.name}, ${nextPlace.address}` 
      : nextPlace.name
  );
  const url = `https://www.google.com/maps/search/${searchQuery}`;
  
  notifyPopup('statusUpdate', {
    message: `Saving place ${savingState.currentIndex + 1}/${savingState.places.length}...`,
    type: 'progress'
  });
  
  // Navigate to next place using callback style
  chrome.tabs.update(savingState.tabId, { url: url }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Navigation error:', chrome.runtime.lastError);
      notifyPopup('statusUpdate', { message: chrome.runtime.lastError.message, type: 'error' });
      return;
    }
    
    // Wait for page load
    const onUpdatedListener = (tabId, info) => {
      if (tabId === savingState.tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdatedListener);
        setTimeout(() => injectAndStart(), 3000);
      }
    };
    
    chrome.tabs.onUpdated.addListener(onUpdatedListener);
  });
};

// Handle error
const handleSaveError = (error) => {
  console.error('Save error:', error);
  notifyPopup('statusUpdate', { message: error, type: 'error' });
  savingState.active = false;
};

// Send message to popup
const notifyPopup = async (action, data) => {
  try {
    await chrome.runtime.sendMessage({ action, ...data });
  } catch (error) {
    // Popup might be closed, that's ok
    console.log('Could not notify popup (may be closed)');
  }
};

console.log('Background script loaded');
