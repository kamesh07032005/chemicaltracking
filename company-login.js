const API_URL = 'http://localhost:3000';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const urn = document.getElementById('urn').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_URL}/companies`);
        const companies = await response.json();
        
        const company = companies.find(c => c.urnNumber === urn && c.password === password);
        
        if (company) {
            const currentDate = new Date();
            const expirationDate = new Date(company.expirationDate);
            
            if (currentDate > expirationDate) {
                document.getElementById('errorMessage').textContent = 'URN has expired';
                return;
            }
            
            sessionStorage.setItem('companyData', JSON.stringify(company));
            window.location.href = 'company-dashboard.html';
        } else {
            document.getElementById('errorMessage').textContent = 'Invalid URN or password';
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('errorMessage').textContent = 'Error connecting to server';
    }
});
