// Fetch configuration from server
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('Failed to load config:', error);
        return null;
    }
}

// Initialize avatar
function initAvatar(config) {
    const avatarDiv = document.getElementById('avatar');
    
    if (config.avatarImageUrl) {
        const img = document.createElement('img');
        img.src = config.avatarImageUrl;
        img.alt = 'Profile';
        
        img.onload = function() {
            avatarDiv.innerHTML = '';
            avatarDiv.appendChild(img);
        };
        
        img.onerror = function() {
            console.error('Failed to load avatar image');
            avatarDiv.innerHTML = `<div class="avatar-placeholder">${config.initials}</div>`;
        };
    } else {
        avatarDiv.innerHTML = `<div class="avatar-placeholder">${config.initials}</div>`;
    }
}

// Update all content from config
function updateContent(config) {
    // Update name
    document.querySelector('.name').textContent = config.name;
    
    // Update tagline
    document.querySelector('.tagline').textContent = config.tagline;
    
    // Update bio
    document.querySelector('.bio').textContent = config.bio;
    
    // Update CV button
    if (config.cvUrl) {
        const cvButton = document.querySelector('.cv-button');
        if (cvButton) {
            cvButton.href = config.cvUrl;
        }
    }
    
    // Update footer copyright
    const currentYear = new Date().getFullYear();
    document.querySelector('footer').textContent = `© ${currentYear} ${config.name}. All rights reserved.`;
    
    // Update social links
    const socialLinks = document.querySelectorAll('.social-link');
    const linkKeys = Object.keys(config.socialLinks);
    socialLinks.forEach((link, index) => {
        if (linkKeys[index] && config.socialLinks[linkKeys[index]]) {
            link.href = config.socialLinks[linkKeys[index]];
    }

    // Update QR code
    if (config.vcardQrUrl) {
        const qrImg = document.querySelector('.qr-frame img');
        if (qrImg) {
            qrImg.src = config.vcardQrUrl;
        }
    }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    const config = await loadConfig();
    
    if (config) {
        initAvatar(config);
        updateContent(config);
    }
});
