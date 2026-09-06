const fetch = require('node-fetch');

async function checkModels() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Using Key:', key);
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching models:', err.message);
  }
}

checkModels();
