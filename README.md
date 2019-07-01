GitHub App PoC
===

Run this server
---

Given `GH_APP_CLIENT_ID`, `GH_APP_CLIENT_SECRET`, `GH_APP_NAME`, `GH_APP_ID`, `GH_APP_KEY_PATH` to execute this server.

Example:
```
GH_APP_CLIENT_ID=Iv1.xxxxxxxxx \
GH_APP_CLIENT_SECRET=xxxxxxxxx \
GH_APP_NAME=xxxxxxxx \
GH_APP_ID=12345 \
GH_APP_KEY_PATH=./xxxxxx.pem \
npm start
```

Install & Authorize GitHub App
---
- Visit http://localhost:3000
- Click the only link on the page
- Install & Authorize your GitHub account and repos
- It should redirect and show your repo branches

Show repo branches
---
- Visit http://localhost:3000/repo/:owner/:repo/branches to show your repo branches

Show repo file tree
---
- Visit http://localhost:3000/repo/:owner/:repo/:sha to show your repo file tree

Show repo file contents
---
- Visit http://localhost:3000/contents/:owner/:repo/:path?ref=master to show your repo file contents
