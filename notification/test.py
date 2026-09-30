import requests

response = requests.get('https://dekkov.pythonanywhere.com/send-email/"ngthaong"')
print(response.status_code)
print(response.json())