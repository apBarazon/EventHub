pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'eventhub'
        TAG = "${env.BUILD_NUMBER}"          // images tagged by build number -> rollback
    }

    triggers {
        pollSCM('H/2 * * * *')               // Poll SCM every ~2 minutes (switch to githubPush() when a webhook is available)
    }

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '15'))
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Test') {
            steps {
                // Runs each module's Dockerfile "test" stage (node:test). A failing test fails the build here.
                sh 'docker build --target test -t eventhub/catalog-api:test ./catalog-api'
                sh 'docker build --target test -t eventhub/report-service:test ./report-service'
            }
        }

        stage('Build Images') {
            steps {
                withCredentials([file(credentialsId: 'eventhub-env', variable: 'ENV_FILE')]) {
                    sh 'cp "$ENV_FILE" .env'
                    sh 'docker compose build'
                }
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose up -d --no-build --remove-orphans'
            }
        }

        stage('Smoke Test') {
            steps { sh './scripts/smoke-test.sh' }
        }
    }

    post {
        success { echo "EventHub build ${TAG} is live at http://localhost:8090" }
        failure { echo "Build ${TAG} failed. Roll back with: TAG=<previous> docker compose -p eventhub up -d --no-build" }
        always  { sh 'rm -f .env' }
    }
}
