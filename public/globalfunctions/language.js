// language.js

function loadLanguage(language) {
    fetch(`/languages/${language}.json`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('navHome').innerText = data.navHome;
            document.getElementById('navFeatures').innerText = data.navFeatures;
            document.getElementById('navPricing').innerText = data.navPricing;
            document.getElementById('navFAQs').innerText = data.navFAQs;
            document.getElementById('navAbout').innerText = data.navAbout;
            document.getElementById('loginButton').innerText = data.loginButton;
            document.getElementById('signupButton').innerText = data.signupButton;
            document.getElementById('titlelanguage').innerText = data.titlelanguage;
            document.getElementById('heroTitle').innerText = data.heroTitle;
            document.getElementById('heroSubtitle').innerText = data.heroSubtitle;
            document.getElementById('heroText1').innerText = data.heroText1;
            document.getElementById('heroText2').innerText = data.heroText2;
            document.getElementById('learnMoreButton').innerText = data.learnMoreButton;
            document.getElementById('maintitlefirstpage').innerText = data.maintitlefirstpage;
            document.getElementById('fullNameLabel').innerText = data.fullNameLabel;
            document.getElementById('loginTitle').innerText = data.loginTitle;
            document.getElementById('forgotpasswordtitle').innerText = data.forgotpasswordtitle;
            document.getElementById('forgotpasswordlink').innerText = data.forgotpasswordlink;
            document.getElementById('usernameLabel').innerText = data.usernameLabel;
            document.getElementById('loginButton').innerText = data.loginButton;
            document.getElementById('sendResetLinkButton').innerText = data.sendResetLinkButton;
            document.getElementById('forgotpasswordtitle').innerText = data.forgotpasswordtitle;
            document.getElementById('forgotpasswordlink').innerText = data.forgotpasswordlink;
            document.getElementById('message').innerText = data.message;
            document.getElementById('pageTitleUserReg').innerText = data.pageTitleUserReg;
        });
}

export default loadLanguage;