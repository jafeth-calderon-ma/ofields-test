document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let records = [];
    let headers = [];
    let currentEditingId = null;
    let githubAuth = {
        owner: 'jafeth-calderon-ma',
        repo: 'ofields-test',
        token: '',
        branch: 'main'
    };
    
    // DOM elements
    const recordForm = document.getElementById('recordForm');
    const saveBtn = document.getElementById('saveBtn');
    const addNewBtn = document.getElementById('addNewBtn');
    const clearBtn = document.getElementById('clearBtn');
    const recordsTable = document.getElementById('recordsTable');
    
    // GitHub elements
    const githubTokenInput = document.getElementById('github-token');
    const saveAuthBtn = document.getElementById('saveAuthBtn');
    const authStatusDiv = document.getElementById('auth-status');
    const commitStatusDiv = document.getElementById('commit-status');
    
    // Form fields
    const formFields = {
        id: document.getElementById('id'),
        name: document.getElementById('name'),
        variable: document.getElementById('variable'),
        category: document.getElementById('category'),
        tableType: document.getElementById('tableType'),
        r: document.getElementById('r'),
        u: document.getElementById('u'),
        p: document.getElementById('p'),
        h: document.getElementById('h'),
        i: document.getElementById('i'),
        d: document.getElementById('d'),
        m: document.getElementById('m'),
        g: document.getElementById('g'),
        x: document.getElementById('x'),
        
        // Scalar fields
        scalarType: document.getElementById('scalarType'),
        scalarSize: document.getElementById('scalarSize'),
        scalarVariable: document.getElementById('scalarVariable'),
        scalarMin: document.getElementById('scalarMin'),
        scalarMax: document.getElementById('scalarMax'),
        
        // Vector fields
        vectorScale: document.getElementById('vectorScale'),
        vectorTableType: document.getElementById('vectorTableType'),
        vectorSize: document.getElementById('vectorSize'),
        vectorOptType: document.getElementById('vectorOptType'),
        vectorShape: document.getElementById('vectorShape'),
        
        // Table fields
        kType: document.getElementById('kType'),
        jj: document.getElementById('jj'),
        tableLinkType: document.getElementById('tableLinkType')
    };
    
    // Get the radio buttons for scalar value source
    const scalarValueSourceRadios = document.getElementsByName('scalarValueSource');
    
    // Get category field containers
    const scalarFieldsContainer = document.querySelector('.scalar-fields');
    const vectorFieldsContainer = document.querySelector('.vector-fields');
    const tableFieldsContainer = document.querySelector('.table-fields');
    
    // Get min/max and assumption fields
    const assumptionField = document.querySelector('.assumption-field');
    const minmaxFields = document.querySelectorAll('.minmax-field');
    
    // Checkbox fields
    const checkboxFields = ['r', 'u', 'p', 'h', 'i', 'd', 'm', 'g', 'x'];
    
    // Additional field names based on category (for CSV headers)
    const scalarFieldNames = ['Scalar Type', 'Scalar Size', 'Scalar Value Source', 'Scalar Variable', 'Scalar Min', 'Scalar Max'];
    const vectorFieldNames = ['Vector Scale', 'Vector Table Type', 'Vector Size', 'Vector Opt Type', 'Vector Shape'];
    const tableFieldNames = ['KType', 'JJ', 'Table Link Type'];
    
    // Event listeners
    saveBtn.addEventListener('click', saveRecord);
    addNewBtn.addEventListener('click', addNewRecord);
    clearBtn.addEventListener('click', clearForm);
    saveAuthBtn.addEventListener('click', saveGitHubAuth);
    
    // Add event listener for category change
    formFields.category.addEventListener('change', handleCategoryChange);
    
    // Add event listeners for scalar value source radio buttons
    scalarValueSourceRadios.forEach(radio => {
        radio.addEventListener('change', toggleScalarValueFields);
    });
    
    // Load saved GitHub authentication
    loadGitHubAuth();
    
    // Show status message
    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = 'status-message ' + type;
        
        // Hide the message after 5 seconds
        setTimeout(() => {
            element.className = 'status-message';
            element.style.display = 'none';
        }, 5000);
    }
    
    // Generic GitHub API request handler with error handling
    function githubRequest(url, options = {}) {
        if (!githubAuth.token) {
            showStatus(commitStatusDiv, 'GitHub authentication required', 'error');
            return Promise.reject(new Error('GitHub authentication required'));
        }
        
        // Set default headers with authentication
        const headers = {
            'Authorization': `token ${githubAuth.token}`,
            ...options.headers
        };
        
        return fetch(url, { ...options, headers })
            .then(response => {
                if (response.status === 404) {
                    return null; // File doesn't exist
                }
                if (!response.ok) {
                    return response.json()
                        .then(errorData => {
                            throw new Error(`GitHub API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
                        })
                        .catch(() => {
                            throw new Error(`GitHub API error: ${response.status}`);
                        });
                }
                if (response.status === 204) { // No Content
                    return null;
                }
                return response.json();
            });
    }
    
    // Save GitHub authentication to sessionStorage
    function saveGitHubAuth() {
        githubAuth.token = githubTokenInput.value.trim();
        
        if (!githubAuth.token) {
            showStatus(authStatusDiv, 'Please enter a GitHub token', 'error');
            return;
        }
        
        // Store token in sessionStorage (more secure, but still not ideal for production)
        sessionStorage.setItem('githubToken', githubAuth.token);
        
        showStatus(authStatusDiv, 'GitHub authentication saved', 'success');
        
        // Test the connection
        testGitHubConnection();
    }
    
    // Load GitHub authentication from sessionStorage
    function loadGitHubAuth() {
        const savedToken = sessionStorage.getItem('githubToken');
        
        if (savedToken) {
            githubAuth.token = savedToken;
            
            if (githubAuth.token) {
                // Load CSV directly from GitHub
                loadCSVFromGitHub();
            }
        } else {
            showStatus(authStatusDiv, 'Please enter GitHub token to load data', 'warning');
        }
    }
    
    // Test GitHub connection
    function testGitHubConnection() {
        const repoUrl = `https://api.github.com/repos/${githubAuth.owner}/${githubAuth.repo}`;
        
        githubRequest(repoUrl)
            .then(data => {
                if (data) {
                    showStatus(authStatusDiv, `Successfully connected to ${data.full_name}`, 'success');
                    loadCSVFromGitHub();
                }
            })
            .catch(error => {
                showStatus(authStatusDiv, `Error connecting to GitHub: ${error.message}`, 'error');
            });
    }
    
    // Load CSV from GitHub
    function loadCSVFromGitHub() {
        const url = `https://api.github.com/repos/${githubAuth.owner}/${githubAuth.repo}/contents/ofields.csv?ref=${githubAuth.branch}`;
        
        githubRequest(url)
            .then(data => {
                if (!data) {
                    // File doesn't exist yet, create empty records
                    headers = ['Id', 'Name', 'Variable', 'Category', 'Table Type', 'R', 'U', 'P', 'H', 'I', 'D', 'M', 'G', 'X', 'JJ', 'KType', 'Table Link Type'];
                    records = [];
                    displayRecords();
                    return;
                }
                
                // Decode content from base64
                const content = atob(data.content);
                parseCSV(content);
                showStatus(commitStatusDiv, 'CSV loaded from GitHub', 'success');
            })
            .catch(error => {
                showStatus(commitStatusDiv, `Error loading CSV from GitHub: ${error.message}`, 'error');
            });
    }
    
    // Parse CSV content
    function parseCSV(content) {
        const lines = content.split('\n');
        if (lines.length === 0) {
            alert('CSV file is empty');
            return;
        }
        
        headers = lines[0].split(',').map(header => header.trim());
        
        records = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const values = lines[i].split(',');
            const record = {};
            
            headers.forEach((header, index) => {
                record[header] = values[index] ? values[index].trim() : '';
                
                // Convert '1'/'0' to boolean for checkbox fields
                if (checkboxFields.includes(header.toLowerCase())) {
                    record[header] = record[header] === '1';
                }
            });
            
            records.push(record);
        }
        
        // Ensure all headers exist by adding any new ones
        const requiredHeaders = [
            'Id', 'Name', 'Variable', 'Category', 'Table Type', 
            'R', 'U', 'P', 'H', 'I', 'D', 'M', 'G', 'X', 
            ...scalarFieldNames,
            ...vectorFieldNames,
            ...tableFieldNames
        ];
        
        // Add any missing headers
        requiredHeaders.forEach(header => {
            if (!headers.includes(header)) {
                headers.push(header);
            }
        });
        
        displayRecords();
    }
    
    // Generate CSV content
    function generateCSV() {
        let csvContent = headers.join(',') + '\n';
        
        records.forEach(record => {
            const row = headers.map(header => {
                let value = record[header];
                
                // Convert boolean to '1'/'0' for checkbox fields
                if (checkboxFields.includes(header.toLowerCase())) {
                    value = value ? '1' : '0';
                } else {
                    value = value || '';
                }
                
                // Handle values with commas by enclosing in quotes
                if (typeof value === 'string' && value.includes(',')) {
                    value = `"${value}"`;
                }
                
                return value;
            });
            csvContent += row.join(',') + '\n';
        });
        
        return csvContent;
    }
    
    // Commit changes to GitHub with automatic commit message based on action
    function commitChangesToGitHub(action, recordId, retryCount = 0) {
        if (retryCount >= 3) {
            showStatus(commitStatusDiv, `Failed after multiple retries. Please try again later.`, 'error');
            return Promise.reject(new Error('Maximum retry attempts reached'));
        }
        
        // Generate appropriate commit message based on the action
        let commitMessage;
        switch (action) {
            case 'add': commitMessage = `Added Optional Field with ID: ${recordId}`; break;
            case 'edit': commitMessage = `Updated Optional Field with ID: ${recordId}`; break;
            case 'delete': commitMessage = `Deleted Optional Field with ID: ${recordId}`; break;
            default: commitMessage = 'Updated ofields.csv';
        }
        
        const csvContent = generateCSV();
        const fileUrl = `https://api.github.com/repos/${githubAuth.owner}/${githubAuth.repo}/contents/ofields.csv?ref=${githubAuth.branch}`;
        
        // First, get the current file to get its SHA
        return githubRequest(fileUrl)
            .then(data => {
                // Create the commit payload
                const payload = {
                    message: commitMessage,
                    content: Base64.encode(csvContent),
                    branch: githubAuth.branch
                };
                
                // If the file already exists, include its SHA
                if (data && data.sha) {
                    payload.sha = data.sha;
                }
                
                // Commit the file
                return githubRequest(fileUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            })
            .then(data => {
                if (data) {
                    showStatus(commitStatusDiv, `${commitMessage} (${data.commit.sha.substring(0, 7)})`, 'success');
                    return data;
                }
            })
            .catch(error => {
                // Handle conflict errors (HTTP 409) with retry logic
                if (error.message.includes('409')) {
                    const retryDelay = 1000 * (retryCount + 1); // Exponential backoff
                    showStatus(commitStatusDiv, `Conflict detected. Retrying in ${retryDelay/1000}s...`, 'warning');
                    
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(commitChangesToGitHub(action, recordId, retryCount + 1));
                        }, retryDelay);
                    });
                }
                
                showStatus(commitStatusDiv, `Error committing to GitHub: ${error.message}`, 'error');
                throw error;
            });
    }
    
    // Display all records in the table
    function displayRecords() {
        const tbody = recordsTable.querySelector('tbody');
        const thead = recordsTable.querySelector('thead');
        tbody.innerHTML = '';
        
        // Rebuild the header row to include all CSV headers
        const headerRow = document.createElement('tr');
        
        // Add Actions column first
        const actionsHeader = document.createElement('th');
        actionsHeader.textContent = 'Actions';
        actionsHeader.className = 'actions-column';
        headerRow.appendChild(actionsHeader);
        
        // Add all data columns from the CSV
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.className = 'data-column';
            headerRow.appendChild(th);
        });
        
        // Replace existing header row
        thead.innerHTML = '';
        thead.appendChild(headerRow);
        
        // Add data rows
        records.forEach(record => {
            const row = document.createElement('tr');
            
            // Add action buttons as the first column
            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-column';
            
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'edit-btn';
            editBtn.addEventListener('click', () => populateForm(record));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'delete-btn';
            deleteBtn.addEventListener('click', () => deleteRecord(record.Id));
            
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(document.createTextNode(' ')); // Add space between buttons
            actionsCell.appendChild(deleteBtn);
            row.appendChild(actionsCell);
            
            // Add data columns
            headers.forEach(header => {
                const cell = document.createElement('td');
                cell.className = 'data-column';
                
                // Display checkboxes as ✓ or ✗
                if (checkboxFields.includes(header.toLowerCase())) {
                    if (record[header]) {
                        cell.innerHTML = '✓';
                        cell.className = 'check-mark';
                    } else {
                        cell.innerHTML = '✗';
                        cell.className = 'x-mark';
                    }
                } else {
                    const value = record[header] || '';
                    cell.textContent = value;
                }
                
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });
    }
    
    // Function to handle category change
    function handleCategoryChange() {
        const category = formFields.category.value;
        
        // Hide all category-specific fields first
        document.querySelectorAll('.category-fields').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show fields based on selected category
        if (category === 'Scalar') {
            scalarFieldsContainer.style.display = 'block';
            // Initialize scalar value source fields
            toggleScalarValueFields();
        } else if (category === 'Vector') {
            vectorFieldsContainer.style.display = 'block';
        } else if (category === 'Table') {
            tableFieldsContainer.style.display = 'block';
        }
    }
    
    // Function to toggle scalar value fields based on radio selection
    function toggleScalarValueFields() {
        const selectedValue = document.querySelector('input[name="scalarValueSource"]:checked').value;
        
        if (selectedValue === 'assumption') {
            assumptionField.style.display = 'block';
            minmaxFields.forEach(field => {
                field.style.display = 'none';
                // Clear Min/Max fields when switching to assumption
                if (field.querySelector('input')) {
                    field.querySelector('input').value = '';
                }
            });
        } else {
            assumptionField.style.display = 'none';
            // Clear Variable field when switching to min/max
            if (formFields.scalarVariable) {
                formFields.scalarVariable.value = '';
            }
            minmaxFields.forEach(field => field.style.display = 'block');
        }
    }
    
    // Populate form with record data
    function populateForm(record) {
        currentEditingId = record.Id;
        
        // Set basic fields
        formFields.id.value = record.Id || '';
        formFields.name.value = record.Name || '';
        formFields.variable.value = record.Variable || '';
        formFields.category.value = record.Category || '';
        formFields.tableType.value = record['Table Type'] || '';
        
        // Disable category field when editing existing record
        formFields.category.disabled = true;
        // Ensure the category is visible even when disabled
        formFields.category.style.backgroundColor = '#f9f9f9';
        formFields.category.style.color = '#555';
        
        // Set checkbox fields
        checkboxFields.forEach(field => {
            formFields[field].checked = !!record[field.toUpperCase()];
        });
        
        // Show fields based on category
        handleCategoryChange();
        
        // Set category-specific fields
        if (record.Category === 'Scalar') {
            formFields.scalarType.value = record['Scalar Type'] || 'Alpha';
            formFields.scalarSize.value = record['Scalar Size'] || 'Integer';
            
            // Set value source radio buttons
            const valueSource = record['Scalar Value Source'] || 'assumption';
            document.querySelector(`input[name="scalarValueSource"][value="${valueSource}"]`).checked = true;
            
            formFields.scalarVariable.value = record['Scalar Variable'] || '';
            formFields.scalarMin.value = record['Scalar Min'] || '';
            formFields.scalarMax.value = record['Scalar Max'] || '';
            
            // Show/hide appropriate fields
            toggleScalarValueFields();
            
        } else if (record.Category === 'Vector') {
            formFields.vectorScale.value = record['Vector Scale'] || '0.001';
            formFields.vectorTableType.value = record['Vector Table Type'] || '';
            formFields.vectorSize.value = record['Vector Size'] || '121';
            formFields.vectorOptType.value = record['Vector Opt Type'] || '';
            formFields.vectorShape.value = record['Vector Shape'] || 'Policy year/quarter';
            
        } else if (record.Category === 'Table') {
            formFields.kType.value = record['KType'] || '';
            formFields.jj.value = record['JJ'] || '';
            formFields.tableLinkType.value = record['Table Link Type'] || '0';
        }
    }
    
    // Clear the form
    function clearForm() {
        currentEditingId = null;
        recordForm.reset();
        
        // Hide all category-specific fields
        document.querySelectorAll('.category-fields').forEach(el => {
            el.style.display = 'none';
        });
        
        // Enable category selection for new records
        formFields.category.disabled = false;
        formFields.category.style.backgroundColor = '';
        formFields.category.style.color = '';
    }
    
    // Save the current record (either add new or update existing)
    function saveRecord() {
        if (!formFields.id.value) {
            alert('ID is required');
            return;
        }
        
        if (!formFields.category.value) {
            alert('Category is required');
            return;
        }
        
        const formData = {
            Id: formFields.id.value,
            Name: formFields.name.value,
            Variable: formFields.variable.value,
            Category: formFields.category.value,
            'Table Type': formFields.tableType.value
        };
        
        // Add checkbox fields
        checkboxFields.forEach(field => {
            formData[field.toUpperCase()] = formFields[field].checked;
        });
        
        // Add category-specific fields
        if (formData.Category === 'Scalar') {
            formData['Scalar Type'] = formFields.scalarType.value;
            formData['Scalar Size'] = formFields.scalarSize.value;
            formData['Scalar Value Source'] = document.querySelector('input[name="scalarValueSource"]:checked').value;
            formData['Scalar Variable'] = formFields.scalarVariable.value;
            formData['Scalar Min'] = formFields.scalarMin.value;
            formData['Scalar Max'] = formFields.scalarMax.value;
        } else if (formData.Category === 'Vector') {
            formData['Vector Scale'] = formFields.vectorScale.value;
            formData['Vector Table Type'] = formFields.vectorTableType.value;
            formData['Vector Size'] = formFields.vectorSize.value;
            formData['Vector Opt Type'] = formFields.vectorOptType.value;
            formData['Vector Shape'] = formFields.vectorShape.value;
        } else if (formData.Category === 'Table') {
            formData['KType'] = formFields.kType.value;
            formData['JJ'] = formFields.jj.value;
            formData['Table Link Type'] = formFields.tableLinkType.value;
        }
        
        let action = 'add'; // Default action
        
        if (currentEditingId) {
            // Update existing record
            const index = records.findIndex(r => r.Id === currentEditingId);
            if (index !== -1) {
                // Preserve the original category if editing
                formData.Category = records[index].Category;
                records[index] = formData;
                action = 'edit';
            }
        } else {
            // Check if ID already exists
            const existingRecord = records.find(r => r.Id === formData.Id);
            if (existingRecord) {
                alert('A record with this ID already exists');
                return;
            }
            
            // Add new record
            records.push(formData);
        }
        
        // Update the display
        displayRecords();
        
        // Auto-commit the change to GitHub
        showStatus(commitStatusDiv, 'Committing changes to GitHub...', 'success');
        
        commitChangesToGitHub(action, formData.Id)
            .then(() => {
                clearForm();
                alert('Record saved and committed to GitHub successfully');
            })
            .catch(error => {
                alert(`Record saved locally but failed to commit to GitHub: ${error.message}`);
            });
    }
    
    // Add a new record
    function addNewRecord() {
        clearForm();
        currentEditingId = null;
    }
    
    // Delete a record
    function deleteRecord(id) {
        if (confirm('Are you sure you want to delete this record?')) {
            const index = records.findIndex(r => r.Id === id);
            if (index !== -1) {
                // Remove the record
                records.splice(index, 1);
                
                // Update the display
                displayRecords();
                
                // If we're currently editing this record, clear the form
                if (currentEditingId === id) {
                    clearForm();
                }
                
                // Auto-commit the deletion to GitHub
                showStatus(commitStatusDiv, 'Committing deletion to GitHub...', 'success');
                
                commitChangesToGitHub('delete', id)
                    .then(() => {
                        alert('Record deleted and committed to GitHub successfully');
                    })
                    .catch(error => {
                        alert(`Record deleted locally but failed to commit to GitHub: ${error.message}`);
                    });
            }
        }
    }
    
    // Initialize the form
    clearForm();
});