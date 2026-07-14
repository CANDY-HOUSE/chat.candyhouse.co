import { fetchAuthSession } from 'aws-amplify/auth'

export async function getIdToken(): Promise<string | undefined> {
  const { tokens } = await fetchAuthSession()
  return tokens?.idToken?.toString()
}
