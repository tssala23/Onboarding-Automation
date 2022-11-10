## Robozome - Github Issue form automation via Tekton

Robozome allows you to create an automated workflow that consumes a GitHub issue form, and automatically creates a
pull request based of those form inputs against a repo of your choice. You supply the form and input handling logic,
and Robozome takes care of the rest.

### How it works

In the background, Robozome reads [Github Issue Forms][1] and uses the Operate-First issue-form [parser][2] to convert
the form into a machine readable format. The issue form specifies, in the form of GitHub labels:
* the location of the input handling logics (scripts)
* the target repo where this logic resides, and where the resulting PR will be created
* the type of task (tekton `Task`) to execute (e.g. if using bash scripts as your input logic, you would use the
  Tekton `task-type:bash`)

### Quickstart via Openshift (OCP)

> Note: this is for a quickstart prod deployment, for development follow the [contributing guide](CONTRIBUTING.md).

Pre-requisites:
* Before starting, you will need an OCP cluster (you can use a Kubernetes cluster, but you'll need to replace the
`routes` with `ingresses`, or expose the `Robozome` some other way).
* Openshift Cluster with project admin in at least one namespace
* Openshift Cluster with Openshift Pipelines or Tekton installed
* Github user account, or organization with owner access

Create the app on your GH user or organization following [these instructions][3].

Leave the `webhook url` field empty for now. Give it a name, description, homepage url, as you see fit.

When creating the app, be sure to create a WebHook secret, the instructions will say it's optional, but for our purposes
it's required. Save this secret. We'll refer to this value as `$WEBHOOK_SECRET`.

Create the app.

You will also be given a private key, save this as well (you can also [re-generate a new one][4] if you lose it).
We'll refer to this value as `$PRIVATE_KEY`.

Also note down the GitHub app's id. We'll refer to this value as `$APP_ID`.
> Note you can find the app id by navigating to [app config][5].

Now install it into your GitHub org, when installing your app ensure your app has access to at least 2 repos:
* one repo where your issue forms will be created
* another repo where you will house your issue form input logic, and where the pr will be created (must be same repo)

Run the following in your terminal:

```bash
$ cd $(mktemp -d)
$ git clone https://github.com/operate-first/robozome.git
$ cd robozome/manifests/robozome

$ cat << EOF > secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: robozome
  annotations:
    kustomize.config.k8s.io/behavior: replace
stringData:
  app_id: $APP_ID
  private_key: $PRIVATE_KEY
  webhook_secret: "$WEBHOOK_SECRET
EOF
```
Fill out `$APP_ID`, `$PRIVATE_KEY`, `$WEBHOOK_SECRET` in the above secret with the values we obtained earlier.

Now deploy the robozome app in your OCP namespace:
```bash

$ oc apply -f secret.yaml
$ kustomzie build . | oc apply -n $YOUR_NAMESPACE -f -
```

Get the route:
```bash
WEBHOOK_URL="http://$(oc get routes -n robozome robozome --template={{.spec.host}})"
```

Navigate back to your GitHub app [config settings][5], and replace the webhook URL with `$WEBHOOK_URL`.

### Adding New Issue forms and input logic

* Assume the repo we're putting our issue forms in is called `$FORMS_REPO`
* Assume the repo we're putting our pr creation input logic is called `$SCRIPTS_REPO`

In the repo `$FORMS_REPO`, create an [issue form][1], the issue form must have these 3 GitHub labels:
* `task-type:$TASK-TYPE`, the value of `$TASK-TYPE` dictates the Tekton task that will be run (currently only `bash` is possible)
* `repo:$SCRIPTS_REPO`, value of `$SCRIPTS_REPO` decided earlier
* `script:$SCRIPTS_PATH`, the location of the script that will process the issue form within `$SCRIPTS_REPO` (relative to root of repo)

Be sure to also create these lables within the `$FORMS_REPO` repository.

Now, in the repo `$SCRIPTS_REPO` add the script that will be executed in the location: `$SCRIPTS_PATH`.

In the automation script, you have the following environment variables available:

* PAYLOAD_PATH - location of the issue form inputs, [see here][2] for the format
* ORG_NAME - the organization this app is deployed in, and where issue/form creation/responses are being generated
* SOURCE_REPO - The repo where the issue was created
* ISSUE_NUMBER - The number of the issue where the issue form was created

### Bash task-type
If creating a bash script to put in `$SCRIPTS_REPO`, your issue should be wrapped in the following code:

```bash
set -o allexport -o pipefail -ex

# YOUR CODE GOES HERE

# ALWAYS END IN A COMMIT, DO NOT PUSH.
cd ${REPO}
git add YOUR-CHANGES
git commit -m "COMMIT MESSAGE"

set -o allexport
```

### Adding new Task Types
Task types are located [here][6]. They are regular Tekton `Tasks`. To add a new task type, create a Task with the name
`issue-form-automation-$YOUR-TYPE`, replace `$YOUR-TYPE` accordingly.

Add the Task to the pipeline [here][7].

### Robozome commands

On issue forms, you can run a couple of helpful commands:

* `/robozome retry` : will re-run the automation pipeline against the designated script
* `/robozome payload` : will show what the payload in $PAYLOAD_PATH will look like, this is useful when generating your
  own scripts for execution against the issue form input.

### Contributing guide

To contribute to Robozome app, please follow the [contributing.md](CONTRIBUTING.md) instructions.

[1]: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
[2]: https://github.com/operate-first/probot-extensions/tree/main/packages/probot-issue-form
[3]: https://docs.github.com/en/developers/apps/building-github-apps/creating-a-github-app
[4]: https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps
[5]: https://docs.github.com/en/developers/apps/managing-github-apps/modifying-a-github-app
[6]: https://github.com/operate-first/robozome/tree/main/manifests/robozome/tasks
[7]: https://github.com/operate-first/robozome/blob/main/manifests/robozome/pipelines/issue-form-pipeline.yaml
