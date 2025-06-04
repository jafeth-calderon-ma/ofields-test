document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let records = [];
    let headers = [];
    let currentEditingId = null;
    let githubAuth = {
        owner: '',
        repo: '',
        token: '',
        branch: 'main'
    };
    
    // DOM elements
    const csvFileInput = document.getElementById('csvFile');
    const loadBtn = document.getElementById('loadBtn');
    const searchIdInput = document.getElementById('searchId');
    const searchBtn = document.getElementById('searchBtn');
    const recordForm = document.getElementById('recordForm');
    const saveBtn = document.getElementById('saveBtn');
    const addNewBtn = document.getElementById('addNewBtn');
    const clearBtn = document.getElementById('clearBtn');
    const recordsTable = document.getElementById('recordsTable');
    const downloadBtn = document.getElementById('downloadBtn');
    
    // GitHub elements
    const repoOwnerInput = document.getElementById('repo-owner');
    const repoNameInput = document.getElementById('repo-name');
    const githubTokenInput = document.getElementById('github-token');
    const branchNameInput = document.getElementById('branch-name');
    const saveAuthBtn = document.getElementById('saveAuthBtn');
    const authStatusDiv = document.getElementById('auth-status');
    const commitMessageInput = document.getElementById('commit-message');
    const commitBtn = document.getElementById('commitBtn');
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
        jj: document.getElementById('jj'),
        kType: document.getElementById('kType'),
        tableLinkType: document.getElementById('tableLinkType')
    };
    
    // Event listeners
    loadBtn.addEventListener('click', loadCSV);
    searchBtn.addEventListener('click', searchRecord);
    saveBtn.addEventListener('click', saveRecord);
    addNewBtn.addEventListener('click', addNewRecord);
    clearBtn.addEventListener('click', clearForm);
    downloadBtn.addEventListener('click', downloadCSV);
    saveAuthBtn.addEventListener('click', saveGitHubAuth);
    commitBtn.addEventListener('click', commitChangesToGitHub);
    
    // Load saved GitHub authentication
    loadGitHubAuth();
    
    // Save GitHub authentication to localStorage
    function saveGitHubAuth() {
        githubAuth = {
            owner: repoOwnerInput.value.trim(),
            repo: repoNameInput.value.trim(),
            token: githubTokenInput.value.trim(),
            branch: branchNameInput.value.trim() || 'main'
        };
        
        if (!githubAuth.owner || !githubAuth.repo || !githubAuth.token) {
            showStatus(authStatusDiv, 'Please fill in all GitHub authentication fields', 'error');
            return;
        }
        
        // Save to localStorage (encrypt token in a real application)
        localStorage.setItem('githubAuth', JSON.stringify({
            owner: githubAuth.owner,
            repo: githubAuth.repo,
            branch: githubAuth.branch
            // Don't store token in localStorage in production!
        }));
        
        // Store token in sessionStorage (more secure, but still not ideal for production)
        sessionStorage.setItem('githubToken', githubAuth.token);
        
        showStatus(authStatusDiv, 'GitHub authentication saved', 'success');
        
        // Test the connection
        testGitHubConnection();
    }
    
    // Load GitHub authentication from localStorage
    function loadGitHubAuth() {
        const savedAuth = localStorage.getItem('githubAuth');
        const savedToken = sessionStorage.getItem('githubToken');
        
        if (savedAuth) {
            const parsedAuth = JSON.parse(savedAuth);
            githubAuth = {
                ...parsedAuth,
                token: savedToken || ''
            };
            
            repoOwnerInput.value = githubAuth.owner;
            repoNameInput.value = githubAuth.repo;
            branchNameInput.value = githubAuth.branch;
            
            // Don't set the token input value for security reasons
            // The user will need to enter it again if sessionStorage is cleared
            
            if (githubAuth.owner && githubAuth.repo && githubAuth.token) {
                // Load CSV directly from GitHub
                loadCSVFromGitHub();
            }
        }
    }
    
    // Test GitHub connection
    function testGitHubConnection() {
        if (!githubAuth.owner || !githubAuth.repo || !githubAuth.token) {
            return;
        }
        
        fetch(`https://api.github.com/repos/${githubAuth.owner}/${githubAuth.repo}`, {
            headers: {
                'Authorization': `token ${githubAuth.token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            showStatus(authStatusDiv, `Successfully connected to ${data.full_name}`, 'success');
        })
        .catch(error => {
            showStatus(authStatusDiv, `Error connecting to GitHub: ${error.message}`, 'error');
        });
    }
    
    // Show status message
    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = 'status-message ' + type;
        
        // Hide the message after 5 seconds
        setTimeout(() => {
            element.className = 'status-message';
        }, 5000);
    }
    
    // Load CSV from GitHub
    function loadCSVFromGitHub() {
        if (!githubAuth.owner || !githubAuth.repo || !githubAuth.token) {
            showStatus(commitStatusDiv, 'GitHub authentication required', 'error');
            return;
        }
        
        const url = `https://api.github.com/repos/${githubAuth.owner}/${githubAuth.repo}/contents/ofields.csv?ref=${githubAuth.branch}`;
        
        fetch(url, {
            headers: {
                'Authorization': `token ${githubAuth.token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    // File doesn't exist yet, create empty records
                    headers = ['Id', 'Name', 'Variable', 'Category', 'Table Type', 'R', 'U', 'P', 'H', 'I', 'D', 'M', 'G', 'X', 'JJ', 'KType', 'Table Link Type'];
                    records = [];
                    displayRecords();
                    return null;
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data) {
                // Decode content from base64
                const content = atob(data.content);
                parseCSV(content);
                showStatus(commitStatusDiv, 'CSV loaded from GitHub', 'success');
            }
        })
        .catch(error => {
            showStatus(commitStatusDiv, `Error loading CSV from GitHub: ${error.message}`, 'error');
            // Load the local CSV file as fallback
            loadLocalCSV();
        });
    }
    
    // Load local CSV file
    function loadLocalCSV() {
        fetch('ofields.csv')
            .then(response => {
                if (!response.ok) {
                    throw new Error('File not found');
                }
                return response.text();
            })
            .then(content => {
                parseCSV(content);
            })
            .catch(error => {
                console.log('No local CSV file found. Creating empty records.');
                headers = ['Id', 'Name', 'Variable', 'Category', 'Table Type', 'R', 'U', 'P', 'H', 'I', 'D', 'M', 'G', 'X', 'JJ', 'KType', 'Table Link Type'];
                records = [];
                displayRecords();
            });
    }
    
    // Load CSV file from input
    function loadCSV() {
        const file = csvFileInput.files[0];
        if (!file) {
            alert('Please select a CSV file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            parseCSV(content);
        };
        reader.readAsText(file);
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
            });
            
            records.push(record);
        }
        
        displayRecords();
    }
    
    // Commit changes to GitHub
    function commitChangesToGitHub() {
        if (!githubAuth.owner || !githubAuth.repo || !githubAuth.token) {
            showStatus(commitStatusDiv, 'GitHub authentication required', 'error');
            return;
        }
        
        const commitMessage = commitMessageInput.value.trim() || 'Update ofields.csv';
        const csvContent = generateCSV();
        
        // First, check if the file exists and get its SHA if it does
        fetch(`https://api.github.com/repos/${githubAuth.owner}/${githubAuth.repo}/contents/ofields.csv?ref=${githubAuth.branch}`, {
            headers: {
                'Authorization': `token ${githubAuth.token}`
            }
        })
        .then(response => {
            if (response.status === 404) {
                return null; // File doesn't exist yet
            }
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            return response.json();
        })
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
            return fetch(`https://api.github.com/repos/${githubAuth.owner}/${githubAuth.repo}/contents/ofields.csv`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${githubAuth.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            showStatus(commitStatusDiv, `Changes committed to GitHub: ${data.commit.sha.substring(0, 7)}`, 'success');
        })
        .catch(error => {
            showStatus(commitStatusDiv, `Error committing to GitHub: ${error.message}`, 'error');
        });
    }
    
    // Generate CSV content
    function generateCSV() {
        let csvContent = headers.join(',') + '\n';
        
        records.forEach(record => {
            const row = headers.map(header => {
                let value = record[header] || '';
                // Handle values with commas by enclosing in quotes
                if (value.includes(',')) {
                    value = `"${value}"`;
                }
                return value;
            });
            csvContent += row.join(',') + '\n';
        });
        
        return csvContent;
    }
    
    // Display all records in the table
    function displayRecords() {
        const tbody = recordsTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        records.forEach(record => {
            const row = document.createElement('tr');
            
            headers.forEach(header => {
                const cell = document.createElement('td');
                cell.textContent = record[header] || '';
                row.appendChild(cell);
            });
            
            // Add action buttons
            const actionsCell = document.createElement('td');
            
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'edit-btn';
            editBtn.addEventListener('click', () => populateForm(record));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'delete-btn';
            deleteBtn.addEventListener('click', () => deleteRecord(record.Id));
            
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
            row.appendChild(actionsCell);
            
            tbody.appendChild(row);
        });
    }
    
    // Search for a record by ID
    function searchRecord() {
        const searchId = searchIdInput.value.trim();
        if (!searchId) {
            alert('Please enter an ID to search');
            return;
        }
        
        const record = records.find(r => r.Id === searchId);
        if (record) {
            populateForm(record);
        } else {
            alert('Record not found');
        }
    }
    
    // Populate form with record data
    function populateForm(record) {
        currentEditingId = record.Id;
        
        formFields.id.value = record.Id || '';
        formFields.name.value = record.Name || '';
        formFields.variable.value = record.Variable || '';
        formFields.category.value = record.Category || '';
        formFields.tableType.value = record['Table Type'] || '';
        formFields.r.value = record.R || '';
        formFields.u.value = record.U || '';
        formFields.p.value = record.P || '';
        formFields.h.value = record.H || '';
        formFields.i.value = record.I || '';
        formFields.d.value = record.D || '';
        formFields.m.value = record.M || '';
        formFields.g.value = record.G || '';
        formFields.x.value = record.X || '';
        formFields.jj.value = record.JJ || '';
        formFields.kType.value = record.KType || '';
        formFields.tableLinkType.value = record['Table Link Type'] || '';
    }
    
    // Clear the form
    function clearForm() {
        currentEditingId = null;
        recordForm.reset();
    }
    
    // Save the current record
    function saveRecord() {
        if (!formFields.id.value) {
            alert('ID is required');
            return;
        }
        
        const formData = {
            Id: formFields.id.value,
            Name: formFields.name.value,
            Variable: formFields.variable.value,
            Category: formFields.category.value,
            'Table Type': formFields.tableType.value,
            R: formFields.r.value,
            U: formFields.u.value,
            P: formFields.p.value,
            H: formFields.h.value,
            I: formFields.i.value,
            D: formFields.d.value,
            M: formFields.m.value,
            G: formFields.g.value,
            X: formFields.x.value,
            JJ: formFields.jj.value,
            KType: formFields.kType.value,
            'Table Link Type': formFields.tableLinkType.value
        };
        
        if (currentEditingId) {
            // Update existing record
            const index = records.findIndex(r => r.Id === currentEditingId);
            if (index !== -1) {
                records[index] = formData;
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
        
        displayRecords();
        clearForm();
        alert('Record saved successfully');
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
                records.splice(index, 1);
                displayRecords();
                if (currentEditingId === id) {
                    clearForm();
                }
                alert('Record deleted successfully');
            }
        }
    }
    
    // Download the CSV file
    function downloadCSV() {
        if (records.length === 0 && headers.length === 0) {
            alert('No records to download');
            return;
        }
        
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'ofields_updated.csv');
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Initialize by trying to load the CSV from GitHub, then from local file
    if (githubAuth.owner && githubAuth.repo && githubAuth.token) {
        loadCSVFromGitHub();
    } else {
        loadLocalCSV();
    }
});
