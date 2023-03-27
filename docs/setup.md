# Setup

After deploying and running Memos in `prod` mode, you should create "host" user. There are two ways to do this:

1. Navigate to the Memos application URL, such as `http://localhost:5230`, and follow the prompts to create a username and password for the "host" user.
2. Use the command `memos setup --host-username=$USERNAME --host-password=$PASSWORD --mode=prod` to set up the host user. This method may be more convenient for deploying through Ansible or other provisioning softwares.
