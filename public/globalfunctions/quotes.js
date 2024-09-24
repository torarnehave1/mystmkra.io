function loadRandomQuote() {
    fetch('/quotes/quotes.json')
        .then(response => response.json())
        .then(data => {
            const randomQuote = data.quotes[Math.floor(Math.random() * data.quotes.length)];
            
            document.getElementById('quote').innerText = randomQuote.Quote;
            document.getElementById('author').innerText = randomQuote.Author;
            document.getElementById('timeperiod').innerText = randomQuote.TimePeriod;
        });
}

export default loadRandomQuote;