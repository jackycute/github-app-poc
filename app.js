const { App } = require('@octokit/app')
const { request } = require('@octokit/request')

const querystring = require('querystring')
const fs = require('fs')
const express = require('express')
const app = express()

const ClientId = process.env.GH_APP_CLIENT_ID
const ClientSecret = process.env.GH_APP_CLIENT_SECRET

const APP_NAME = process.env.GH_APP_NAME
const APP_ID = process.env.GH_APP_ID
const PRIVATE_KEY = fs.readFileSync(process.env.GH_APP_KEY_PATH, 'utf-8')
const ghApp = new App({ id: APP_ID, privateKey: PRIVATE_KEY })

app.set('view engine', 'jade')
app.set('views', './views')

app.get('/', function (req, res) {
  res.render('index', { app_name: APP_NAME, client_id: ClientId })
})

app.get('/callback', async function (req, res) {
  console.log(`Callback\n------`)
  console.log(req.query)
  const { code, installation_id, setup_action } = req.query

  try {
    const { data: data } = await request('POST /login/oauth/access_token', {
      baseUrl: 'https://github.com',
      headers: {
        accept: '',
        'user-agent': '',
        'content-type': ''
      },
      client_id: ClientId,
      client_secret: ClientSecret,
      code: code,
      redirect_uri: 'http://localhost:3000/callback'
    })
    const token = querystring.decode(data).access_token
    console.log(`User Access Token: ${token}`)

    const { data: installations } = await request('GET /user/installations', {
      headers: {
        accept: 'application/vnd.github.machine-man-preview+json',
        authorization: `token ${token}`
      }
    })
    console.log('User Installations\n------')
    console.log(JSON.stringify(installations, null, 2))

    const installationId = installation_id || installations.installations[0].id
    const { data: repositories } = await request(`GET /user/installations/${installationId}/repositories`, {
      headers: {
        accept: 'application/vnd.github.machine-man-preview+json',
        authorization: `token ${token}`
      }
    })
    console.log(`Installed Repositories for installation id: ${installationId}\n------`)
    console.log(JSON.stringify(repositories, null, 2))

    const repo = repositories.repositories[0]
    res.redirect(`/repo/${repo.owner.login}/${repo.name}/branches`)
  } catch (err) {
    res.send(err)
  }
})

app.get('/repo/:owner/:repo/branches', async function (req, res) {
  try {
    const branches = await getRepoBranches(req.params.owner, req.params.repo)
    res.render('context', { context: JSON.stringify(branches, null, 2) })
  } catch (err) {
    res.send(err)
  }
})

app.get('/repo/:owner/:repo/:sha', async function (req, res) {
  try {
    const tree = await getRepoTree(req.params.owner, req.params.repo, req.params.sha)
    res.render('context', { context: JSON.stringify(tree, null, 2) })
  } catch (err) {
    res.send(err)
  }
})

app.get('/contents/:owner/:repo/:path*', async function (req, res) {
  try {
    const path = req.params.path + req.params[0]
    const contents = await getRepoContents(req.params.owner, req.params.repo, path, req.query.ref)
    res.render('context', { context: JSON.stringify(contents, null, 2) })
  } catch (err) {
    res.send(err)
  }
})

async function getInstallationId (owner, repo) {
  try {
    const jwt = ghApp.getSignedJsonWebToken()

    // Example of using authenticated app to GET an individual installation
    // https://developer.github.com/v3/apps/#find-repository-installation
    const { data } = await request("GET /repos/:owner/:repo/installation", {
      owner: owner,
      repo: repo,
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: "application/vnd.github.machine-man-preview+json"
      }
    })

    // contains the installation id necessary to authenticate as an installation
    const installationId = data.id
    return installationId
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function getRepoBranches (owner, repo) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: branches } = await request(`GET /repos/:owner/:repo/branches`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo
    })
    console.log(`Branches for repo: /${owner}/${repo}\n------`)
    console.log(JSON.stringify(branches, null, 2))
    return branches
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function getBranchReference (owner, repo, branch) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: reference } = await request(`GET /repos/:owner/:repo/git/refs/:ref`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      ref: `heads/${branch}`
    })
    console.log(`Reference for repo: /${owner}/${repo}/git/refs/${branch}\n------`)
    console.log(JSON.stringify(reference, null, 2))
    return reference
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function createBranchReference (owner, repo, ref, sha) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: reference } = await request(`POST /repos/:owner/:repo/git/refs`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      ref: `refs/heads/${ref}`,
      sha
    })
    console.log(`Reference for repo: /${owner}/${repo}/git/refs\n------`)
    console.log(JSON.stringify(reference, null, 2))
    return reference
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function updateBranchReference (owner, repo, ref, sha, force = false) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: reference } = await request(`PATCH /repos/:owner/:repo/git/refs/:ref`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      ref: `heads/${ref}`,
      sha,
      force
    })
    console.log(`Reference for repo: /${owner}/${repo}/git/refs/${ref}\n------`)
    console.log(JSON.stringify(reference, null, 2))
    return reference
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function getRepoTree (owner, repo, sha) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: tree } = await request(`GET /repos/:owner/:repo/git/trees/:tree_sha`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      tree_sha: sha
    })
    console.log(`Tree for repo: /${owner}/${repo}/git/trees/${sha}\n------`)
    console.log(JSON.stringify(tree, null, 2))
    return tree
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function createBlob (owner, repo, content) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: blob } = await request(`POST /repos/:owner/:repo/git/blobs`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      content,
      encoding: 'utf-8'
    })
    console.log(`Blob for repo: /${owner}/${repo}/git/blobs\n------`)
    console.log(JSON.stringify(blob, null, 2))
    return blob
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function createRepoTree (owner, repo, baseTreeSha, path, content) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: tree } = await request(`POST /repos/:owner/:repo/git/trees`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: [{
        path,
        mode: '100644',
        type: 'blob',
        content
      }]
    })
    console.log(`Tree for repo: /${owner}/${repo}/git/trees\n------`)
    console.log(JSON.stringify(tree, null, 2))
    return tree
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function createCommmit (owner, repo, message, authorName, authorEmail, authorDate, parentSha, treeSha) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const parents = parentSha ? [parentSha] : undefined
    const { data: commit } = await request(`POST /repos/:owner/:repo/git/commits`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      message,
      author: {
        name: authorName,
        email: authorEmail,
        data: authorDate
      },
      parents,
      tree: treeSha
    })
    console.log(`Commit for repo: /${owner}/${repo}/git/commits\n------`)
    console.log(JSON.stringify(commit, null, 2))
    return commit
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function createRepoContents (owner, repo, path, message, content, branch, authorName, authorEmail) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const author = (authorName && authorEmail) ? {
      authorName,
      authorEmail
    } : undefined
    const { data: contents } = await request(`PUT /repos/:owner/:repo/contents/:path`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      path,
      message,
      content,
      branch,
      author
    })
    console.log(`Contents for repo: /${owner}/${repo}/contents/${path}\n------`)
    console.log(JSON.stringify(contents, null, 2))
    return contents
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function deleteInstallation (installationId) {
  try {
    const jwt = ghApp.getSignedJsonWebToken()

    const result = await request(`DELETE /app/installations/:installation_id`, {
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: "application/vnd.github.gambit-preview+json"
      },
      installation_id: installationId
    })
    console.log(result)
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function getRepoContents (owner, repo, path, ref) {
  try {
    const installationId = await getInstallationId(owner, repo)
    const installationAccessToken = await ghApp.getInstallationAccessToken({
      installationId
    })
    console.log(`Installation Access Token: ${installationAccessToken}`)

    const { data: contents } = await request(`GET /repos/:owner/:repo/contents/:path?ref=:ref`, {
      headers: {
        authorization: `token ${installationAccessToken}`
      },
      owner,
      repo,
      path,
      ref: ref || 'master'
    })
    console.log(`Contents for repo: /${owner}/${repo}/contents/${path}\n------`)
    console.log(JSON.stringify(contents, null, 2))
    return contents
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function main () {
  try {
    // Retrieve JSON Web Token (JWT) to authenticate as app
    const jwt = ghApp.getSignedJsonWebToken()
    const { data: appDetails } = await request('GET /app', {
      headers: {
        authorization: `Bearer ${jwt}`
      },
      previews: ["machine-man"]
    })
    console.log('GitHub App Details\n------')
    console.log(appDetails)

    app.listen(3000)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

main()
