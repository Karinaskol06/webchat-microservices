// Declarative pipeline as code
pipeline {
    // runs on any agent (currently - the Jenkins container itself)
    agent any

    options {
        // Adds time to every log line to see how long each step took
        timestamps()
        // One build per branch at a time to avoid running two tests/deploys in parallel
        disableConcurrentBuilds()
    }

    environment {
        // Variable available to all stages
        KUBE_NS = 'webchat-dev'
        // GHCR image prefix
        GHCR_OWNER = 'karinaskol06'
        GHCR_PREFIX = "ghcr.io/${GHCR_OWNER}/webchat"
    }

    // Pipeline starts
    stages {
        stage('Backend Test') {
            steps {
                sh 'mvn -B test'
            }
            post {
                failure {
                    // Save test failures as jenkins artifacts to read them in UI
                    archiveArtifacts artifacts: '**/target/surefire-reports/**', allowEmptyArchive: true
                }
            }
        }

        stage('Frontend Test') {
            steps {
                // Runs all commands inside this subfolder
                dir('webchat_frontend') {
                    // Stops immediately if any command fails
                    // Does clean install from package-lock.json
                    // Does lint checks and vitest unit tests
                    sh '''
                        set -e
                        npm ci
                        npm run lint
                        npm test
                    '''
                }
            }
        }

        // Parallel builds — each service runs as its own branch of this stage
        stage('Docker Build') {
            parallel {
                stage('discovery-service') {
                    steps {
                        sh 'docker build -f discovery-service/Dockerfile -t webchat/discovery-service:local -t webchat/discovery-service:b${BUILD_NUMBER} -t ${GHCR_PREFIX}-discovery-service:b${BUILD_NUMBER} .'
                    }
                }
                stage('user-service') {
                    steps {
                        sh 'docker build -f user-service/Dockerfile -t webchat/user-service:local -t webchat/user-service:b${BUILD_NUMBER} -t ${GHCR_PREFIX}-user-service:b${BUILD_NUMBER} .'
                    }
                }
                stage('auth-service') {
                    steps {
                        sh 'docker build -f auth-service/Dockerfile -t webchat/auth-service:local -t webchat/auth-service:b${BUILD_NUMBER} -t ${GHCR_PREFIX}-auth-service:b${BUILD_NUMBER} .'
                    }
                }
                stage('chat-service') {
                    steps {
                        sh 'docker build -f chat-service/Dockerfile -t webchat/chat-service:local -t webchat/chat-service:b${BUILD_NUMBER} -t ${GHCR_PREFIX}-chat-service:b${BUILD_NUMBER} .'
                    }
                }
                stage('notification-service') {
                    steps {
                        sh 'docker build -f notification-service/Dockerfile -t webchat/notification-service:local -t webchat/notification-service:b${BUILD_NUMBER} -t ${GHCR_PREFIX}-notification-service:b${BUILD_NUMBER} .'
                    }
                }
                stage('api-gateway') {
                    steps {
                        sh 'docker build -f api-gateway/Dockerfile -t webchat/api-gateway:local -t webchat/api-gateway:b${BUILD_NUMBER} -t ${GHCR_PREFIX}-api-gateway:b${BUILD_NUMBER} .'
                    }
                }
                stage('frontend') {
                    steps {
                        sh 'docker build -f webchat_frontend/Dockerfile -t webchat/frontend:local -t webchat/frontend:b${BUILD_NUMBER} -t ${GHCR_PREFIX}-frontend:b${BUILD_NUMBER} webchat_frontend'
                    }
                }
            }
        }

        // Push to GHCR
        stage('Push GHCR') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'cicd-processes'
                }
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'ghcr-webchat',
                    usernameVariable: 'REGISTRY_USER',
                    passwordVariable: 'REGISTRY_PASS'
                )]) {
                    sh '''
                        set -e
                        echo "$REGISTRY_PASS" | docker login ghcr.io -u "$REGISTRY_USER" --password-stdin
                        for svc in discovery-service user-service auth-service chat-service notification-service api-gateway frontend; do
                          docker push "${GHCR_PREFIX}-${svc}:b${BUILD_NUMBER}"
                          docker tag "${GHCR_PREFIX}-${svc}:b${BUILD_NUMBER}" "${GHCR_PREFIX}-${svc}:latest"
                          docker push "${GHCR_PREFIX}-${svc}:latest"
                        done
                        docker logout ghcr.io
                    '''
                }
            }
        }

        stage('Deploy') {
            // Local K8s still uses :local tags from Docker Build (same daemon)
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'cicd-processes'
                }
            }
            steps {
                // K8s restarts all services deployments and picks up changes
                // Waits for each rollout to finish
                sh '''
                    set -e
                    for dep in discovery-service user-service auth-service chat-service notification-service api-gateway frontend; do
                      kubectl rollout restart "deployment/${dep}" -n "${KUBE_NS}"
                    done
                    for dep in discovery-service user-service auth-service chat-service notification-service api-gateway frontend; do
                      kubectl rollout status "deployment/${dep}" -n "${KUBE_NS}" --timeout=180s
                    done
                '''
            }
        }
    }

    // Always runs after all stages
    post {
        success {
            echo "Pipeline OK — branch=${env.BRANCH_NAME} build=#${env.BUILD_NUMBER}"
        }
        failure {
            echo "Pipeline FAILED — branch=${env.BRANCH_NAME} build=#${env.BUILD_NUMBER}"
        }
    }
}
