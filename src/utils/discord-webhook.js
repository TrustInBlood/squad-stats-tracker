const fetch = require('node-fetch');

async function editOriginalInteractionResponse(applicationId, token, content, embed) {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  const body = { content, flags: 64 };
  if (embed) {
    body.embeds = [embed];
    // If using embeds, Discord requires content to be null or a string
    if (!content) body.content = null;
  }
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