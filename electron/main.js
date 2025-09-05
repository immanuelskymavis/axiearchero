const { app, BrowserWindow } = require('electron');
const path = require('path');

const PORT = 5174;

function createWindow () {
  const win = new BrowserWindow({
    width: 900,      // Reduced for a more compact demo window
    height: 600,     // Reduced height for better focus
    title: 'Factory Demo',
    // Use the official 128×128 Factory icon from tutorial assets
    icon: path.join(__dirname, '../assets/128x128.png'),
    // Ensure the window is given focus when created
    focus: true
  });

  win.loadURL(`http://localhost:${PORT}`);

  // Explicitly focus the window after it finishes loading to bring it
  // to the foreground on application start.
  win.focus();
}

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create a window when the dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Create window when Electron is ready
app.whenReady().then(createWindow);
