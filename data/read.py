'''
We're only gonna show events from 2013, and we're gonna add them
two more fields:

soon - if it's happening after March
label - a two characters representation of where the event is taking place

We;ll use this in the app JS
'''

import json
from dateutil.parser import parse

json_data = open('events.json').read()
data = json.loads(json_data)

app_events = []

for event in data:
    if event['start_date'] > '2013':
        event['soon'] = True if event['start_date'] > '2013-03' else False
        event['label'] = event['state'][0:2] if event['state'] else event['country'][0:2]
        event['easy_date'] = parse(event['start_date']).strftime('%B %d, %Y')
        app_events.append(event)

print json.dumps(app_events)
