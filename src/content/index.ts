console.log('StyleSniffer Content Script Loaded');

import { onMessage } from 'webext-bridge/content-script';
import { selector } from './selector';

// Listen for toggle command from Popup
onMessage('toggle-selection', ({ data }) => {
  console.log('Received toggle command:', data);
  const shouldActive = data as boolean;
  if (shouldActive) {
    selector.activate();
  } else {
    selector.deactivate();
  }
});

// Listen for toggle command from Background (Click) - Raw Chrome Message for Broadcast
chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (message) {
        if (message.type === 'style-sniffer-toggle') {
            console.log('Received toggle request from background (Broadcast)');
            selector.toggle();
        } else if (message.type === 'style-sniffer-deactivate') {
             console.log('Received deactivate request from background (Broadcast)');
             selector.deactivate();
        }
    }
});
