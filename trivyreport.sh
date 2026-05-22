#!/bin/bash

# Baca file JSON
json=$(cat "${CI_PROJECT_NAME}_${CI_PIPELINE_CREATED_AT}.json")

# Ekstrak array "Vulnerabilities" yang berada dalam objek "Results" di dalam objek "Metadata"
results=$(echo "$json" | jq -r '.Results')

# Cek apakah "Vulnerabilities" tidak null
if [ "$results" != "null" ]; then
    gitlab_body="<h4>Vulnerability Summary</h4><hr>"

    while IFS= read -r line; do
        vulnerabilityID=$(echo "$line" | jq -r '.VulnerabilityID')
        pkgID=$(echo "$line" | jq -r '.PkgID')
        pkgName=$(echo "$line" | jq -r '.PkgName')
        installedVersion=$(echo "$line" | jq -r '.InstalledVersion')
        status=$(echo "$line" | jq -r '.Status')
        severity=$(echo "$line" | jq -r '.Severity')
        publishedDate=$(echo "$line" | jq -r '.PublishedDate')
        lastModifiedDate=$(echo "$line" | jq -r '.LastModifiedDate')
        
        if [ "$severity" == "HIGH" ]; then
        # Tambahkan nilai-nilai ke dalam gitlab_body
        gitlab_body+="Vulnerability ID: <b>$vulnerabilityID</b><br>Package ID: <b>$pkgID</b><br>Package Name: <b>$pkgName</b><br>Installed Version: <b>$installedVersion</b><br>Status: <b>$status</b><br>Severity: <b>$severity</b><br>Published Date: <b>$publishedDate</b><br>Last Modified Date: <b>$lastModifiedDate</b><br>-------------------------<br>"
        fi
    done < <(echo "$results" | jq -c '.[] | .Vulnerabilities[]')
    
    # Output gitlab_body setelah loop selesai
    echo "$gitlab_body"

    # Update catatan merge request
    if [[ -n "$gitlab_body" ]]; then
        # Menambahkan gitlab_body ke catatan merge request
        curl --location --request POST "https://repopo.transtrack.id/api/v4/projects/$project_id/merge_requests/$merge_iid/notes" \
        --header "Content-Type: application/json" \
        --header "PRIVATE-TOKEN: $repopo_token" \
        --data-raw "{\"body\": \"$gitlab_body\"}"
    else
        echo "Tidak ada data Vulnerabilities yang ditemukan."
    fi

else
    echo "Tidak ada data Vulnerabilities yang ditemukan."
fi