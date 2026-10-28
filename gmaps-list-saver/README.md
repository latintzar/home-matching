# Google Maps List Saver

A Chrome extension that saves places to Google Maps lists with one click by automating the native Google Maps UI.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `gmaps-list-saver` folder

## How to Use

1. Click the extension icon in your browser toolbar
2. Add places you want to save (or use the demo places)
3. Set a list name
4. Click "Save to Google Maps"
5. The extension will:
   - Open Google Maps
   - Search for each place
   - Click the Save button
   - Add it to your list

## How It Works

Unlike trying to call Google's internal APIs directly (which requires cryptographic tokens), this extension:
- Uses **UI automation** - it literally clicks the buttons in Google Maps
- Works because Google's own code generates the authentication tokens
- Is more reliable as it doesn't depend on reverse-engineering APIs

## Files

- `manifest.json` - Extension configuration
- `popup.html/js` - The popup UI when you click the extension
- `background.js` - Coordinates the saving process
- `content.js` - Runs on Google Maps and performs the clicks
- `icons/` - Extension icons

## Limitations

- Requires you to be logged into Google
- Takes a few seconds per place (UI automation isn't instant)
- Google Maps UI changes could break the selectors

## Troubleshooting

If saving doesn't work:
1. Make sure you're logged into Google
2. Try refreshing Google Maps
3. Check the browser console for errors
4. The extension needs the place to be found on Google Maps

## Development

To modify the extension:
1. Edit the files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Test again
