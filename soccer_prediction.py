import requests
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

# Fetch historical match data from the soccer stats API
def fetch_match_data(api_key):
    endpoint = 'https://api.football-data.org/v2/matches'
    headers = {'X-Auth-Token': 'f9158ecbccbd4a679a7cb09b861bc602'}
    response = requests.get(endpoint, headers=headers)
    data = response.json()
    print('match data', data)
    return data['matches']

# Preprocess the match data
def preprocess_data(matches):
    processed_data = []
    for match in matches:
        home_goals = match['score']['fullTime']['homeTeam']
        away_goals = match['score']['fullTime']['awayTeam']

        # Check if home_goals and away_goals are not None
        if home_goals is not None and away_goals is not None:
            # Extract relevant features from the match data
            home_team = match['homeTeam']['name']
            away_team = match['awayTeam']['name']
            outcome = 'win' if home_goals > away_goals else 'loss' if home_goals < away_goals else 'draw'

            # Append the processed match data to the list
            processed_data.append({'HomeTeam': home_team, 'AwayTeam': away_team, 'HomeGoals': home_goals, 'AwayGoals': away_goals, 'Outcome': outcome})

    # Convert the list of dictionaries into a pandas DataFrame
    df = pd.DataFrame(processed_data)
    return df

# Train a logistic regression model
def train_model(df):
    # Split the data into features (X) and labels (y)
    X = df[['HomeGoals', 'AwayGoals']]
    y = df['Outcome']

    # Split the data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train the logistic regression model
    model = LogisticRegression()
    model.fit(X_train, y_train)
    
    return model, X_test, y_test

# Evaluate the model
def evaluate_model(model, X_test, y_test):
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print("Accuracy:", accuracy)
    print("Classification Report:\n", classification_report(y_test, y_pred))
    print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))

# Serialize the trained model
def save_model(model):
    joblib.dump(model, 'soccer_prediction_model.pkl')

def main():
    # Replace 'your_api_key' with your actual API key
    api_key = 'f9158ecbccbd4a679a7cb09b861bc602'

    # Fetch historical match data from the soccer stats API
    matches = fetch_match_data(api_key)

    # Preprocess the match data
    df = preprocess_data(matches)

    # Train a logistic regression model
    model, X_test, y_test = train_model(df)

    # Evaluate the model
    evaluate_model(model, X_test, y_test)

    # Serialize the trained model
    save_model(model)

if __name__ == "__main__":
    main()
