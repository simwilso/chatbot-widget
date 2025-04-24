# chatbot-widget

How to Update the Knowledge Base and Redeploy
Update the Content:
Open the knowledgebase.md file in your favorite text editor and make any changes or add new information you want to include.

Recompute the Embeddings:
Your project uses a precomputed file (created by precompute_embeddings.py) that breaks up the knowledge base into small chunks and calculates “embeddings” (a way for the computer to understand the text).

Open your terminal in your project’s folder.
Run the command:
`python3 precompute_embeddings.py`
This will update the embeddings.json file with the latest information from your updated knowledgebase.md.
Save Your Changes:
After updating knowledgebase.md and regenerating embeddings.json, commit your changes with Git:
`git add knowledgebase.md embeddings.json`
`git commit -m "Update knowledge base and embeddings"`
Push to GitHub:
Push your changes to your GitHub repository:
`git push origin main`

Netlify Rebuild:
Once your changes are pushed, Netlify automatically picks them up, rebuilds your site, and redeploys your updated functions. You can monitor the deployment in your Netlify dashboard.

Check the Live Site:
Visit your website to verify that the updated knowledge base is now being used by the chatbot.

