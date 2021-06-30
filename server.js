require('dotenv').config()

const express = require('express')

const app = express()

const { google } = require('googleapis')
const scopes = ['https://www.googleapis.com/auth/analytics', 'https://www.googleapis.com/auth/analytics.edit']
const jwt = new google.auth.JWT(process.env.CLIENT_EMAIL, null, process.env.PRIVATE_KEY, scopes)

async function getPropertiesList(){
    const response = await jwt.authorize()
    const result = await google.analytics('v3').management.webproperties.list({
        'auth': jwt,
        'accountId': process.env.ACCOUNT_ID
    })

    // get properties names if defaultProfileId exists
    return result.data.items.map(item => {
        return item.defaultProfileId ? { name: item.name, id: item.defaultProfileId } : false
    })
}

async function getDailyData(viewId, startDate, endDate, organic = false) {
    const analyticsReporting = google.analyticsreporting({
        version: 'v4',
        auth: jwt
    })

    let filter = ''
    if (organic) {
        filter = 'ga:medium==organic'
    }

    const res = await analyticsReporting.reports.batchGet({
        requestBody: {
            reportRequests: [{
                viewId: viewId,
                dateRanges: [{
                    startDate: startDate,
                    endDate: endDate
                }],
                metrics: [{
                    expression: 'ga:sessions'
                }],
                filtersExpression: filter
            }]
        }
    })

    return res.data.reports[0].data.totals[0].values[0]
}

async function getData() {
    const viewId = '222499599'
    const data = {
        today: {
            total: await getDailyData(viewId, 'today', 'today'),
            organic: await getDailyData(viewId, 'today', 'today', true),
        },
        yesterday: {
            total: await getDailyData(viewId, 'yesterday', 'yesterday'),
            organic: await getDailyData(viewId, 'yesterday', 'yesterday', true),
        },
    }
    console.log(data)
}

getData()


app.listen(3000, () => console.log('Server Ready'))