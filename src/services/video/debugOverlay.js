export function createDebugOverlay(videoElement) {
    let overlay = document.getElementById('pgs-debug-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pgs-debug-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '10px';
        overlay.style.left = '10px';
        overlay.style.zIndex = '999999';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
        overlay.style.color = 'lime';
        overlay.style.padding = '10px';
        overlay.style.fontFamily = 'monospace';
        overlay.style.fontSize = '24px';
        overlay.style.whiteSpace = 'pre-wrap';
        if (videoElement.parentElement) {
            videoElement.parentElement.appendChild(overlay);
        }
    }
    return overlay;
}
