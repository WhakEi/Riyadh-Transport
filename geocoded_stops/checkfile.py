import json

input_path = 'missing.json'

with open(input_path) as file:
        data = json.load(file)

print(data)
