const bcrypt = require('bcryptjs');

const verifyAdmin = (req, res, next) => {
    const adminPassword = req.headers['admin-password'];
    
    if (adminPassword === process.env.ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Admin access required' });
    }
};

const hashGroupPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

const compareGroupPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

module.exports = { 
    verifyAdmin, 
    hashGroupPassword, 
    compareGroupPassword 
};