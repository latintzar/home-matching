// Google Maps List Saver - Popup Script

let places = [];

// DOM Elements
const placesList = document.getElementById('placesList');
const emptyState = document.getElementById('emptyState');
const placeCount = document.getElementById('placeCount');
const addPlaceBtn = document.getElementById('addPlaceBtn');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const listNameInput = document.getElementById('listName');

// Modal elements
const addModal = document.getElementById('addModal');
const placeName = document.getElementById('placeName');
const placeAddress = document.getElementById('placeAddress');
const modalCancel = document.getElementById('modalCancel');
const modalAdd = document.getElementById('modalAdd');

// Load saved places from storage
const loadPlaces = async () => {
  const result = await chrome.storage.local.get(['places', 'listName']);
  if (result.places) {
    places = result.places;
    renderPlaces();
  }
  if (result.listName) {
    listNameInput.value = result.listName;
  }
};

// Save places to storage
const savePlaces = async () => {
  await chrome.storage.local.set({ 
    places, 
    listName: listNameInput.value 
  });
};

// Render places list
const renderPlaces = () => {
  placeCount.textContent = places.length;
  
  if (places.length === 0) {
    placesList.innerHTML = `
      <div class="empty-state">
        <p>No places added yet</p>
      </div>
    `;
    saveBtn.disabled = true;
    return;
  }
  
  saveBtn.disabled = false;
  placesList.innerHTML = places.map((place, index) => `
    <div class="place-item" data-index="${index}">
      <span class="place-icon">📍</span>
      <div class="place-info">
        <div class="place-name">${escapeHtml(place.name)}</div>
        ${place.address ? `<div class="place-coords">${escapeHtml(place.address)}</div>` : ''}
      </div>
      <button class="place-remove" data-index="${index}">×</button>
    </div>
  `).join('');
  
  // Add remove handlers
  document.querySelectorAll('.place-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      places.splice(index, 1);
      savePlaces();
      renderPlaces();
    });
  });
};

// Escape HTML to prevent XSS
const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Show modal
addPlaceBtn.addEventListener('click', () => {
  addModal.classList.add('show');
  placeName.value = '';
  placeAddress.value = '';
  placeName.focus();
});

// Hide modal
modalCancel.addEventListener('click', () => {
  addModal.classList.remove('show');
});

// Add place from modal
modalAdd.addEventListener('click', () => {
  const name = placeName.value.trim();
  if (!name) {
    placeName.focus();
    return;
  }
  
  places.push({
    name,
    address: placeAddress.value.trim() || null
  });
  
  savePlaces();
  renderPlaces();
  addModal.classList.remove('show');
});

// Handle Enter key in modal
placeName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    placeAddress.focus();
  }
});

placeAddress.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    modalAdd.click();
  }
});

// Close modal on outside click
addModal.addEventListener('click', (e) => {
  if (e.target === addModal) {
    addModal.classList.remove('show');
  }
});

// Save list name on change
listNameInput.addEventListener('change', savePlaces);

// Show status message
const showStatus = (message, type) => {
  status.textContent = message;
  status.className = `status show ${type}`;
};

// Main save function
saveBtn.addEventListener('click', async () => {
  if (places.length === 0) return;
  
  const listName = listNameInput.value.trim() || 'My Saved Places';
  
  showStatus('Opening Google Maps...', 'progress');
  saveBtn.disabled = true;
  
  try {
    // First, open the Google Maps tab directly from popup (more reliable)
    const firstPlace = places[0];
    // Use place name + address for better search results
    const searchQuery = encodeURIComponent(
      firstPlace.address 
        ? `${firstPlace.name}, ${firstPlace.address}` 
        : firstPlace.name
    );
    const url = `https://www.google.com/maps/search/${searchQuery}`;
    
    // Create tab directly from popup context
    chrome.tabs.create({ url: url }, async (tab) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        saveBtn.disabled = false;
        return;
      }
      
      showStatus('Google Maps opened! Starting automation...', 'progress');
      
      // Now tell background to take over with this tab
      chrome.runtime.sendMessage({
        action: 'startSaving',
        listName,
        places,
        tabId: tab.id
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
    showStatus('Error: ' + error.message, 'error');
    saveBtn.disabled = false;
  }
});

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'statusUpdate') {
    showStatus(message.message, message.type);
    if (message.type === 'success' || message.type === 'error') {
      saveBtn.disabled = false;
    }
  }
  if (message.action === 'savingComplete') {
    showStatus(`✅ Saved ${message.count} places to "${message.listName}"!`, 'success');
    saveBtn.disabled = false;
  }
});

// Initialize
loadPlaces();

// Add some demo places if empty (for testing)
if (places.length === 0) {
  places = [
    { name: 'Testi Restaurant', address: 'London, UK' },
    { name: 'Walthamstow Marshes', address: 'London, UK' }
  ];
  savePlaces();
  renderPlaces();
}
