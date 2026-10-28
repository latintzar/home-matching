/**
 * Leo Vibe Maps - Popup Script
 * Handles both default vibe areas and premium AI-generated areas
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const activateBtn = document.getElementById('activateBtn');
  const infoBox = document.getElementById('infoBox');
  const mainContent = document.getElementById('mainContent');
  const notSupported = document.getElementById('notSupported');
  
  // Premium elements
  const tripInput = document.getElementById('tripInput');
  const generateBtn = document.getElementById('generateBtn');
  const generateBtnText = document.getElementById('generateBtnText');
  const generateSpinner = document.getElementById('generateSpinner');
  const errorMsg = document.getElementById('errorMsg');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Check if we're on a supported site
  const isSupported = tab.url && (
    tab.url.includes('airbnb.com') || 
    tab.url.includes('airbnb.co.uk') ||
    tab.url.includes('airbnb.es') ||
    tab.url.includes('booking.com')
  );

  if (!isSupported) {
    mainContent.style.display = 'none';
    notSupported.style.display = 'block';
    return;
  }

  // State
  let isActivated = false;
  let isGenerating = false;

  /**
   * Update UI based on state
   */
  function updateUI() {
    if (isActivated) {
      statusDot.classList.add('active');
      statusDot.classList.remove('pending');
      statusText.textContent = 'Vibe areas active';
      activateBtn.textContent = '✅ Active';
      activateBtn.classList.add('active');
      infoBox.textContent = 'Hover over circles to see neighborhood info. Click to zoom in!';
    } else {
      statusDot.classList.remove('active', 'pending');
      statusText.textContent = 'Ready to activate';
      activateBtn.textContent = '🗺️ Show Barcelona Areas';
      activateBtn.classList.remove('active');
      infoBox.textContent = 'Hover over circles for info, click to zoom in!';
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    setTimeout(() => {
      errorMsg.style.display = 'none';
    }, 5000);
  }

  /**
   * Set generating state
   */
  function setGenerating(generating) {
    isGenerating = generating;
    generateBtn.disabled = generating;
    generateBtnText.textContent = generating ? 'Generating...' : '🎯 Generate Custom Areas';
    generateSpinner.style.display = generating ? 'block' : 'none';
    
    if (generating) {
      statusDot.classList.add('pending');
      statusDot.classList.remove('active');
      statusText.textContent = 'AI generating areas...';
    }
  }

  /**
   * Check with content script for actual status
   */
  async function checkStatus() {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      if (response) {
        isActivated = response.isActivated || response.isInjected;
        updateUI();
      }
    } catch (error) {
      console.log('Status check error:', error);
    }
  }

  /**
   * Handle Generate Custom Areas button (Premium)
   */
  generateBtn.addEventListener('click', async () => {
    const tripDescription = tripInput.value.trim();
    
    if (!tripDescription) {
      showError('Please describe your trip first');
      tripInput.focus();
      return;
    }
    
    if (tripDescription.length < 10) {
      showError('Please provide more details about your trip');
      tripInput.focus();
      return;
    }
    
    setGenerating(true);
    errorMsg.style.display = 'none';
    
    try {
      console.log('🎯 Requesting AI-generated areas for:', tripDescription);
      
      // Call background script to generate areas
      const response = await chrome.runtime.sendMessage({
        action: 'generateVibeAreas',
        tripDescription: tripDescription,
        city: 'Barcelona'
      });
      
      console.log('📡 Background response:', response);
      
      if (response.success && response.areas) {
        console.log('✅ Got AI areas:', response.areas);
        
        // Send AI areas to content script
        await chrome.tabs.sendMessage(tab.id, {
          action: 'activateWithAreas',
          areas: response.areas
        });
        
        isActivated = true;
        updateUI();
        infoBox.textContent = `AI generated ${response.areas.length} custom areas for your trip!`;
        
        // Close popup after success
        setTimeout(() => window.close(), 1500);
        
      } else {
        throw new Error(response.error || 'Failed to generate areas');
      }
      
    } catch (error) {
      console.error('❌ Generate error:', error);
      showError(error.message || 'Failed to generate areas. Try again.');
    } finally {
      setGenerating(false);
    }
  });

  /**
   * Handle Show Default Areas button
   */
  activateBtn.addEventListener('click', async () => {
    if (isActivated) {
      // Already active - toggle off
      isActivated = false;
      await chrome.storage.local.set({ leoVibeActivated: false });
      
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      } catch (error) {
        console.log('Toggle error:', error);
      }
    } else {
      // Activate with default areas
      isActivated = true;
      await chrome.storage.local.set({ leoVibeActivated: true });
      
      activateBtn.textContent = '⏳ Activating...';
      activateBtn.disabled = true;

      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'activate' });
        
        setTimeout(() => {
          activateBtn.disabled = false;
          updateUI();
        }, 1000);
        
      } catch (error) {
        console.log('Activate error:', error);
        activateBtn.disabled = false;
        showError('Error activating. Refresh the page.');
      }
    }

    updateUI();
  });

  /**
   * Allow Enter key in textarea to submit
   */
  tripInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateBtn.click();
    }
  });

  // Initial state
  updateUI();
  
  // Check actual status from content script
  await checkStatus();
});
