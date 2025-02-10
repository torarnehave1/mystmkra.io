import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/test-search-and-compile', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>Test Search and Compile</h1>
                <form id="searchForm">
                    <label for="query">Query:</label>
                    <input type="text" id="query" name="query" required>
                    <button type="submit">Search</button>
                </form>
                <div id="results"></div>
                <script>
                    document.getElementById('searchForm').addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const query = document.getElementById('query').value;
                        try {
                            const response = await fetch('/search-and-compile', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ query })
                            });
                            const result = await response.json();
                            document.getElementById('results').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
                        } catch (error) {
                            document.getElementById('results').innerHTML = '<p>Error: ' + error.message + '</p>';
                        }
                    });
                </script>
            </body>
        </html>
    `);
});

export default router;
