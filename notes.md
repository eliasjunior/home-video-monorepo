printf '%s' '$2b$10$00.NOnXfqWk8gdPA5OjYlevOI.ySNXZHA8wb.XFSJN8bYZLh5Ph0m' > /Users/eliasjunior/Projects/portfolio/home-video-monorepo/secrets/admin_password_hash   


cd /Users/eliasjunior/Projects/portfolio/home-video-monorepo

# If bcrypt isn't installed yet in apps/api, run this once:
npm --prefix apps/api install

# Generate a hash
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('chorao',10).then(h=>console.log(h))"
printf '%s' '$2b$10$1r4JMbFJ2qmX0liYGJdb.e2eK3MV1sVYhxI1xdSCFwOIo1jWRaOhO' > /home/gandalf/Projects/home-video-monorepo/secrets/admin_password_hash