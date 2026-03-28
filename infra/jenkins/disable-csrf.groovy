import jenkins.model.Jenkins

def instance = Jenkins.get()
instance.setCrumbIssuer(null)
instance.save()
println "CSRF protection disabled"
