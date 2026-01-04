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
