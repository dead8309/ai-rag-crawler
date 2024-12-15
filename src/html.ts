export const HTML = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI URL Chat</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-white min-h-screen flex items-center justify-center">
        <div class="bg-gray-100 p-8 rounded-lg shadow-md w-full max-w-2xl">
            <h1 class="text-2xl font-bold mb-4">AI URL Chat</h1>
            <form id="urlForm" class="mb-4">
                <input type="url" id="urlInput" placeholder="Enter URL" required
                       class="w-full p-2 border rounded mb-2">
                <button type="submit" class="w-full bg-blue-500 text-white p-2 rounded">Submit URL</button>
            </form>
            <div id="chatContainer" class="h-64 overflow-y-auto border p-4 mb-4"></div>
            <form id="chatForm">
                <input type="text" id="messageInput" placeholder="Ask about the URL..." required
                       class="w-full p-2 border rounded mb-2">
                <button type="submit" class="w-full bg-green-500 text-white p-2 rounded">Send</button>
            </form>
        </div>
        <script>
            let currentUrl = '';

            document.getElementById('urlForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                currentUrl = document.getElementById('urlInput').value;
                addMessage('System', 'URL submitted: ' + currentUrl);
            });

            document.getElementById('chatForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const messageInput = document.getElementById('messageInput');
                const message = messageInput.value;
                addMessage('You', message);
                messageInput.value = '';

                const response = await fetch('/api/sites/ask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ site: currentUrl, question: message }),
                });


                const reader = response.body.getReader();
                let aiMessage = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = new TextDecoder().decode(value);
                    const lines = chunk.split('\\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(5));
                                aiMessage += data.response;
                                updateLastMessage('AI', aiMessage);
                            } catch (error) {
                                console.error('Error parsing JSON:', error);
                            }
                        }
                    }
                }
            });

            function addMessage(sender, content) {
                const chatContainer = document.getElementById('chatContainer');
                const messageElement = document.createElement('div');
                messageElement.innerHTML = '<strong>' + sender + ':</strong> ' + content;
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            function updateLastMessage(sender, content) {
                const chatContainer = document.getElementById('chatContainer');
                let lastMessage = chatContainer.lastElementChild;
                if (!lastMessage || lastMessage.querySelector('strong').textContent !== sender + ':') {
                    addMessage(sender, content);
                } else {
                    lastMessage.innerHTML = '<strong>' + sender + ':</strong> ' + content;
                }
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        </script>
    </body>
    </html>`;
