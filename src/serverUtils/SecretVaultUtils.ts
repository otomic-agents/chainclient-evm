import needle from "needle"
import bcrypt from "bcrypt"

export const accessToken = () => new Promise<string>(async (result, reject) => {

    let timestamp = (new Date().getTime() / 1000).toFixed(0);
    let text = process.env.OS_API_KEY + timestamp + process.env.OS_API_SECRET;
    let token = await bcrypt.hash(text, 10);

    let body = {
        "app_key": process.env.OS_API_KEY,
        "timestamp": parseInt(timestamp),
        "token": token,
        "perm": {
          "group": "secret.infisical",
          "dataType": "secret",
          "version": "v1",
          "ops": ["CreateSecret?workspace=otmoic", "RetrieveSecret?workspace=otmoic"]
        }
    }

    try {
        
        needle.post(`http://${process.env.OS_SYSTEM_SERVER}/permission/v1alpha1/access`, body,
            {
                headers: {
                    "Content-Type": "application/json"
                }
            },
            (err, resp) => {
            console.log('error:', err)
            console.log('resp:', resp.body)

            if (err) {
                reject()
            } else {
                result(resp.body.data.access_token)
            }

        })
    } catch (error) {
        console.error(error)
        return
    }
})

export const createKey = async () => {
    needle.post(`http://${process.env.OS_SYSTEM_SERVER}/system-server/v1alpha1/secret/secret.infisical/v1/CreateSecret?workspace=otmoic`, 
    {
        name: 'test-create',
        value: '058d185b433e50118a1bd451c13a7602df50b060e4a83e3b5057f5feff98fd3f',
        env: 'prod'
    }, {
        headers: {
            "Content-Type": "application/json",
            // "Content-Type": "application/x-www-form-urlencoded",
            'X-Access-Token': await accessToken()
        }
    }, (err: any, resp: any) => {
        console.log('error:', err)
        console.log('resp:', resp?.body)
    })
}

export const getKey = (name: string) => new Promise<string>(async (resolve, reject) => {
    needle.post(`http://${process.env.OS_SYSTEM_SERVER}/system-server/v1alpha1/secret/secret.infisical/v1/RetrieveSecret?workspace=otmoic`, 
    {
        name: name,
        env: 'prod'
    }, {
        headers: {
            "Content-Type": "application/json",
            // "Content-Type": "application/x-www-form-urlencoded",
            'X-Access-Token': await accessToken()
        }
    }, (err: any, resp: any) => {
        console.log('error:', err)
        console.log('resp:', resp?.body)

        if (err == null && resp.body && resp.body.data && resp.body.data.data && resp.body.data.data.value) {
            resolve(resp.body.data.data.value);
        } else {
            throw new Error(`not found key ${name}`);
        }
    })
})