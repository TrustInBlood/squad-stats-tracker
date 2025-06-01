const fetch = require('node-fetch');

async function editOriginalInteractionResponse(applicationId, token, content) {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  const body = { content, flags: 64 }; // 64 = ephemeral
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to edit interaction response: ${response.status} ${await response.text()}`);
  }
}

module.exports = { editOriginalInteractionResponse }; 