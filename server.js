require('dotenv').config()

const express = require('express')
const moment = require('moment')
const path = require('path')
const { google } = require('googleapis')
const scopes = ['https://www.googleapis.com/auth/analytics', 'https://www.googleapis.com/auth/analytics.edit']
const jwt = new google.auth.JWT(process.env.CLIENT_EMAIL, null, process.env.PRIVATE_KEY, scopes)
const fs = require('fs')

const dataFilePath = './data/data.json'

const app = express()

app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'views'))

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
    const list = await getPropertiesList()

    const daysAgo30 = moment().subtract(30, 'days').format('YYYY-MM-DD')
    const daysAgo60 = moment().subtract(60, 'days').format('YYYY-MM-DD')

    const getDataOfItem = async item => {
        return {
            yesterday: {
                total: (await getDailyData(item.id, 'yesterday', 'yesterday')),
                organic: await getDailyData(item.id, 'yesterday', 'yesterday', true),
            },
            monthly: {
                total: await getDailyData(item.id, '30daysAgo', 'today'),
                improvement_total: await getDailyData(item.id, daysAgo60, daysAgo30),
                organic: await getDailyData(item.id, '30daysAgo', 'today', true),
                improvement_organic: await getDailyData(item.id, daysAgo60, daysAgo30, true),
            }
        }
    }

    /**
     *  Every function returns a promise, every promise must resolve until we can get the result.
        Then we await the result of Promise.all(), since itself returns a promise.
     */
    return result = await Promise.all(list.map(item => getDataOfItem(item)))

}

const storeData = (data) => {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

const loadData = () => {
    try {
        const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
        return data
    } catch (err) {
        console.error(err)
        return false
    }
}

async function getTodayData() {
    const list = await getPropertiesList()

    const getDataOfItem = async item => {
        return {
            property: item,
            today: {
                total: (await getDailyData(item.id, 'today', 'today')),
                organic: await getDailyData(item.id, 'today', 'today', true),
            }
        }
    }
    return await Promise.all(list.map(item => getDataOfItem(item)))
}

// get the last update date of a file
const getFileUpdatedDate = (path) => {
    const stats = fs.statSync(path)
    return stats.mtime
}

// check if a date is "today"
const isToday = (someDate) => {
    const today = new Date()
    return someDate.getDate() == today.getDate &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear()
}

// check if a file was modified "today"
const wasModifiedToday = (path) => {
    return isToday(getFileUpdatedDate(path))
}

const getAnalyticsData = async () => {
    let data = null
    if (fs.existsSync(dataFilePath) && wasModifiedToday(dataFilePath)) {
        data = loadData()
    } else {
        data = {
            aggregate: await getData()
        }
        storeData()
    }
    data.today = await getTodayData();
    
    data.sums = data.aggregate.reduce((acc, current) => {
        return {
            today: {
                total: parseInt(current.today.total) + parseInt(acc.today.total),
                organic: parseInt(current.today.organic) + parseInt(acc.today.organic)
            },
            yesterday: {
                total: parseInt(current.yesterday.total) + parseInt(acc.yesterday.total),
                organic: parseInt(current.yesterday.organic) + parseInt(acc.yesterday.organic)
            },
            monthly: {
                total: parseInt(current.monthly.total) + parseInt(acc.monthly.total),
                organic: parseInt(current.monthly.organic) + parseInt(acc.monthly.organic)
            },
        }
    }, {
        today: { total: 0, organic: 0 },
        yesterday: { total: 0, organic: 0 },
        monthly: { total: 0, organic: 0 }
    })
    
    data.sites = data.aggregate.map(item => {
        return {
            name: item.property.name,
            id: item.property.id
        }
    })

    return data
}

const data = getAnalyticsData()
data.then(data => {
    console.log(data)
    app.get('/', (req, res) => res.render('index', data))
    express().listen(3000, () => console.log('Server Ready'))
})

app.get('/stats', (req, res) => {
    const site = req.query.site

    if (site === 'All') {
        res.json(data.sums)
        return
    } else {
        const filteredData = data.aggregate.filter(item => item.property.name === site)
        res.json(filteredData[0])
    }
})