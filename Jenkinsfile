pipeline {
    agent any

    parameters {
        string(name: 'ROLLBACK_TAG', defaultValue: '',
               description: 'Leave empty for a normal build. Enter a previous build number (e.g. 2) to redeploy that version without rebuilding.')
    }

    environment {
        COMPOSE_PROJECT_NAME = 'eventhub'
        TAG = "${params.ROLLBACK_TAG ?: env.BUILD_NUMBER}"   // rollback tag if given, else this build's number
    }

    triggers {
        pollSCM('H/2 * * * *')
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
            when { expression { !params.ROLLBACK_TAG } }
            steps {
                sh 'docker build --target test -t eventhub/catalog-api:test ./catalog-api'
                sh 'docker build --target test -t eventhub/report-service:test ./report-service'
            }
        }

        stage('Build Images') {
            when { expression { !params.ROLLBACK_TAG } }
            steps {
                withCredentials([file(credentialsId: 'eventhub-env', variable: 'ENV_FILE')]) {
                    sh 'cp "$ENV_FILE" .env'
                    sh 'docker compose build'
                }
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([file(credentialsId: 'eventhub-env', variable: 'ENV_FILE')]) {
                    sh 'cp "$ENV_FILE" .env'
                    sh 'docker compose up -d --no-build --remove-orphans'
                }
            }
        }

        stage('Smoke Test') {
            steps { sh './scripts/smoke-test.sh' }
        }
    }

    post {
        success { echo "EventHub version ${TAG} is live at http://localhost:8090" }
        failure { echo "Deploy of version ${TAG} failed. Re-run with Build with Parameters and set ROLLBACK_TAG to a previous good build number." }
        always  { sh 'rm -f .env' }
    }
}