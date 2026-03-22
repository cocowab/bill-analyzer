import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    console.error('API Error:', err.response?.data?.detail || err.message)
    return Promise.reject(err)
  }
)

export default request
