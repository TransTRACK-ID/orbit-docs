# Fetching data from SonarQube API
sonar_data=$(curl --location "https://sonar.transtrack.id/api/measures/component?component=$key&metricKeys=bugs%2Cvulnerabilities%2Csecurity_hotspots%2Ccode_smells%2Cline_coverage%2Ccoverage%2Cduplicated_lines%2Cduplicated_lines_density%2Calert_status%2Cquality_gate_details" \
--header "Authorization: Basic $sonar_token")

# Extracting relevant data without jq
key=$(echo "$sonar_data" | grep -o '"key":"[^"]*' | awk -F'"' '{print $4}')
bugs=$(echo "$sonar_data" | grep -o '"metric":"bugs","value":"[^"]*' | awk -F'"' '{print $8}')
vulnerabilities=$(echo "$sonar_data" | grep -o '"metric":"vulnerabilities","value":"[^"]*' | awk -F'"' '{print $8}')
security_hotspots=$(echo "$sonar_data" | grep -o '"metric":"security_hotspots","value":"[^"]*' | awk -F'"' '{print $8}')
code_smells=$(echo "$sonar_data" | grep -o '"metric":"code_smells","value":"[^"]*' | awk -F'"' '{print $8}')
coverage=$(echo "$sonar_data" | grep -o '"metric":"coverage","value":"[^"]*' | awk -F'"' '{print $8}')
line_coverage=$(echo "$sonar_data" | grep -o '"metric":"line_coverage","value":"[^"]*' | awk -F'"' '{print $8}')
duplicated_lines=$(echo "$sonar_data" | grep -o '"metric":"duplicated_lines","value":"[^"]*' | awk -F'"' '{print $8}')
duplicated_lines_density=$(echo "$sonar_data" | grep -o '"metric":"duplicated_lines_density","value":"[^"]*' | awk -F'"' '{print $8}')
alert_status=$(echo "$sonar_data" | grep -o '"metric":"alert_status","value":"[^"]*' | awk -F'"' '{print $8}')
quality_gate_details=$(echo "$sonar_data" | grep -o '"metric":"quality_gate_details","value":"[^"]*' | awk -F'"' '{print $8}')

if [ "$alert_status" = "OK" ]; then
    status="<h4>:ship: Quality Gate $alert_status</h4><hr>"
else
    status="<h4>:fire: Quality Gate $alert_status</h4><hr>"
fi

# Create a formatted string for GitLab body
gitlab_body="$status</span>[See analysis details on SonarQube](https://sonar.transtrack.id/dashboard?id=$key)<br><h4>Issues Summary</h4><hr>:beetle: <b>$bugs</b> Bugs from SonarQube<br>:beginner: <b>$vulnerabilities</b> Vulnerabilities<br>:unlock: <b>$security_hotspots</b> Security Hotspots<br>:radioactive: <b>$code_smells</b> Code Smells<br><h4>Coverage and Duplications</h4><hr>:no_entry_sign: <b>$line_coverage%</b> Coverage (Coverage on <b>$line_coverage</b> Lines to cover)<br>:o: <b>$duplicated_lines_density%</b> Duplication (Duplications on <b>$duplicated_lines</b> Lines)"

# Fetching data from GitLab API
gitlab_data=$(curl --location "https://repopo.transtrack.id//api/v4/projects/$project_id/merge_requests/$merge_iid/notes" \
--header 'Content-Type: application/json' \
--header "PRIVATE-TOKEN: $repopo_token" \
--data "{
    \"body\": \"$gitlab_body\"
}")

# Parsing relevant data from GitLab response (assuming JSON format)
# You need to adjust this based on the actual structure of the response
# This is just a placeholder example
merge_request_notes=$(echo "$gitlab_data" | grep -o '"body":"[^"]*' | awk -F'"' '{print $4}')

# Plotting data using a simple echo
echo "GitLab Merge Request Notes:"
echo "{
    \"body\": \"$gitlab_body\"
}"
