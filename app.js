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
  res.render('index', { app_name: APP_NAME })
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

    const { data: repositories } = await request(`GET /user/installations/${installation_id}/repositories`, {
      headers: {
        accept: 'application/vnd.github.machine-man-preview+json',
        authorization: `token ${token}`
      }
    })
    console.log(`Installed Repositories for installation id: ${installation_id}\n------`)
    console.log(JSON.stringify(repositories, null, 2))

    const repo = repositories.repositories[0]
    res.redirect(`/repo/${repo.owner.login}/${repo.name}/branches`)
  } catch (err) {
    console.error(err)
    res.redirect('/')
  }
})

app.get('/repo/:owner/:repo/branches', async function (req, res) {
  const branches = await getRepoBranches(req.params.owner, req.params.repo)
  res.render('context', { context: JSON.stringify(branches, null, 2) })
})

async function getRepoBranches (owner, repo) {
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
  }
}

main()
