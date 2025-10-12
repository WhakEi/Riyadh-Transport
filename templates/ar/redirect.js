// A simple script to redirect mobile users to the mobile-friendly version.

// We use a screen width threshold. 768px is a common breakpoint for tablets.
const isMobile = window.innerWidth <= 768;

// Get the current path. We want to redirect to "mobile.html" in the same directory.
const currentPath = window.location.pathname;
const isAlreadyOnMobilePage = currentPath.endsWith('mobile.html');

if (isMobile && !isAlreadyOnMobilePage) {
    // Construct the new URL and redirect.
    const newPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1) + 'mobile.html';
    window.location.replace(newPath);
}
