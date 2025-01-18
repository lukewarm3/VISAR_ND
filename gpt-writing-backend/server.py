import re
import os
import json
from dotenv import load_dotenv
from datetime import datetime, timezone
from openai import OpenAI
from flask import Flask, redirect, render_template, request, url_for, make_response, jsonify
from flask_cors import CORS, cross_origin
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from bson.objectid import ObjectId

app = Flask(__name__)
cors = CORS(app)
#CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})
app.config['CORS_HEADERS'] = 'Content-Type'
model_type = "gpt-4o"
tempature = 0.6
max_tokens = 2048
enablePreload = True # enable the preload of editor state, editor node, and flow node
test = False

load_dotenv()

open_ai_key = os.getenv("OPEN_AI_KEY")
OpenAIClient = OpenAI(api_key=open_ai_key)

mongoDB_key = os.getenv("MONGO_DB_KEY")

# Update your mongoDB key here. You need to create a new mongoDB database called "gptwriting", and create collections called "users" and "interactionData" in the database.

client = MongoClient(mongoDB_key)
db = client.gptwriting
db.classes.create_index("class_number", unique=True)

def validate_password(password):
    if len(password) < 8 or len(password) > 20:
        return False, "Password must be between 8 and 20 characters long."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[!@#$%^&*]", password):
        return False, "Password must contain at least one special character (!@#$%^&*)."
    return True, ""


@app.route("/signup", methods=["POST"])
def signup():
    if request.method == "POST":
        response = request.get_json()
        username = response["username"]
        password = response["password"]
        role = response["role"]
        full_name = response.get("full_name", "")
        signup_code = response.get("signup_code")
        
        # Add class registration for students
        if role == "student" and signup_code:
            class_exists = db.classes.find_one({"class_number": signup_code})
            if not class_exists:
                return jsonify({"status": "fail", "message": "Invalid class code"})
        
        is_valid, error_message = validate_password(password)
        if not is_valid:
            return jsonify({"status": "fail", "message": error_message})
        
        user = db.users.find_one({"username": username})
        if user is not None:
            return jsonify({"status": "fail", "message": "Username already exists"})
        
        user_id = ObjectId()
        hashed_password = generate_password_hash(password)
        user_data = {
            "_id": user_id,
            "username": username,
            "password": hashed_password,
            "role": role,
            "full_name": full_name,
            "latestSessionId": -1,
            "created_at": datetime.now()
        }
        
        # Add class reference for students
        if role == "student" and signup_code:
            user_data["class_id"] = class_exists["_id"]
        
        db.users.insert_one(user_data)
        
        return jsonify({
            "status": "success", 
            "message": "Signup successful",
            "userId": str(user_id),
            "role": role,
            "teacherId": str(user_id) if role == "teacher" else None,
            "firstTimeLogin": True
        })

@app.route("/login", methods=["POST"])
def login():
    if request.method == "POST":
        response = request.get_json()
        username = response["username"]
        password = response["password"]
        
        user = db.users.find_one({"username": username})
        if user is None:
            return jsonify({"status": "fail", "message": "User not found"})
        
        if not check_password_hash(user["password"], password):
            return jsonify({"status": "fail", "message": "Password incorrect"})
        
        role = user["role"]
        
        response_data = {
            "status": "success",
            "message": "Login successful",
            "role": user["role"],
            "userId": str(user["_id"]),
            "username": user["username"],
            "condition": "advanced",
            "preload": False,
            "editorState": "",
            "flowSlice": "",
            "editorSlice": "",
            "firstTimeLogin": False
        }

        if role == "teacher":
            response_data["teacherId"] = str(user["_id"])
        elif user["latestSessionId"] != -1 and enablePreload:
            state = db.drafts.find_one({"username": username, "sessionId": user["latestSessionId"]})
            if state:  # Only update if state exists
                response_data.update({
                    "preload": True,
                    "editorState": state["editorState"],
                    "flowSlice": state["flowSlice"],
                    "editorSlice": state["editorSlice"],
                })

        # Update last_active timestamp
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_active": datetime.now(timezone.utc)}}
        )

        return jsonify(response_data)
            
@app.route("/teacher/<teacher_id>", methods=["GET"])
def teacher_dashboard(teacher_id):
    class_id = request.args.get('class_id')
    teacher = db.users.find_one({"_id": ObjectId(teacher_id), "role": "teacher"})
    if not teacher:
        return jsonify({"status": "fail", "message": "Teacher not found"}), 404

    # Get all classes for this teacher
    if class_id:
        # If class_id is provided, only get students from that class
        students = list(db.users.find({
            "class_id": ObjectId(class_id),
            "role": "student"
        }))
    else:
        # Get all classes for this teacher
        teacher_classes = list(db.classes.find({"teacher_id": ObjectId(teacher_id)}))
        class_ids = [c["_id"] for c in teacher_classes]
        
        # Get all students in these classes
        students = list(db.users.find({
            "class_id": {"$in": class_ids},
            "role": "student"
        }))

    student_metrics = []
    total_essays = 0
    total_words = 0
    total_interactions = 0
    total_students = 0
    
    for student in students:
        # Get drafts using the same query as /drafts endpoint
        drafts = list(db.drafts.find({"username": student["username"]}))
        draft_count = len(drafts)
        
        # Calculate total words from drafts
        draft_total_words = sum(len(draft.get("draft", "").split()) 
                              for draft in drafts 
                              if draft.get("draft"))
        
        # Get session metrics - convert to milliseconds for frontend
        sessions = list(db.sessions.find({"student_id": student["_id"]}))
        last_active = max((session.get("end_time") for session in sessions), default=None)
        
        
        total_time = sum(
            session.get("duration", 0) 
            for session in sessions 
            if isinstance(session.get("duration"), (int, float))
        )
         
        if last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=timezone.utc)
        last_active = last_active.isoformat()
        
        # Get GPT interactions
        gpt_interactions = db.interactionData.count_documents({
            "username": student["username"]
        })
        
        student_metrics.append({
            "id": str(student["_id"]),
            "username": student["username"],
            "draft_count": draft_count,
            "total_words": draft_total_words,
            "total_time": total_time,
            "last_active": last_active,
            "full_name": student["full_name"],
            "gpt_interactions": gpt_interactions
        })
        
        # Update aggregates
        total_students += 1
        total_essays += draft_count
        total_words += draft_total_words
        total_interactions += gpt_interactions

    return jsonify({
        "status": "success",
        "teacher": {
            "id": str(teacher["_id"]),
            "username": teacher["username"],
            "full_name": teacher["full_name"]
        },
        "students": student_metrics,
        "aggregate_metrics": {
            "total_essays": total_essays,
            "avg_words_per_essay": total_words / total_essays if total_essays > 0 else 0,
            "total_interactions": total_interactions,
            "total_students": total_students
        }
    })

@app.route("/log_usage", methods=["POST"])
def log_usage():
    data = request.get_json()
    user_id = data["user_id"]
    time_spent = data["time_spent"]
    
    db.usage.update_one(
        {"user_id": ObjectId(user_id)},
        {
            "$inc": {"total_time": time_spent, "login_count": 1},
            "$set": {"last_login": datetime.now()}
        },
        upsert=True
    )
    
    return jsonify({"status": "success", "message": "Usage logged successfully"})

@app.route("/log_session", methods=["POST"])
def log_session():
    data = request.get_json()
    session = {
        "student_id": ObjectId(data["student_id"]),
        "start_time": datetime.fromisoformat(data["start_time"]),
        "end_time": datetime.fromisoformat(data["end_time"]),
        "duration": data["duration"],
        "active_time": data["active_time"],
        "idle_time": data["duration"] - data["active_time"]
    }
    db.sessions.insert_one(session)
    return jsonify({"status": "success"})

@app.route("/log_essay", methods=["POST"])
def log_essay():
    data = request.get_json()
    essay = {
        "student_id": ObjectId(data["student_id"]),
        "title": data["title"],
        "content": data["content"],
        "keywords": data["keywords"],
        "word_count": len(data["content"].split()),
        "completion_status": data["status"],
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    db.essays.insert_one(essay)
    return jsonify({"status": "success"})

@app.route("/logInteractionData", methods=["POST"])
def logInteractionData():
    if request.method == "POST":
        response = request.get_json()
        username = response["username"]
        sessionId = response["sessionId"]
        type = response["type"]
        interactionData = response["interactionData"]
        db.interactionData.insert_one(
            {"username": username, "sessionId": sessionId, "type": type, "interactionData": interactionData})
        return jsonify({"status": "success", "message": "Interaction data logged successfully"})

@app.route("/loadDraft", methods=["POST"])
def load_draft():
    data = request.get_json()
    username = data["username"]
    draft_id = data["draftId"]
    
    draft = db.drafts.find_one({"_id": ObjectId(draft_id)})
    if not draft:
        return jsonify({"status": "fail", "message": "Draft not found"})
        
    return jsonify({
        "status": "success",
        "editorState": draft["editorState"],
        "flowSlice": draft["flowSlice"],
        "editorSlice": draft["editorSlice"],
        "introSlice": draft["introSlice"]
    })

@app.route("/drafts", methods=["GET"])
def get_drafts():
    username = request.args.get("username")
    if not username:
        return jsonify({"status": "fail", "message": "Username required"}), 400
        
    drafts = list(db.drafts.find(
        {"username": username},
        {"title": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1))
    
    return jsonify({
        "status": "success",
        "drafts": [{
            "id": str(d["_id"]),
            "title": d["title"],
            "created_at": d["created_at"].isoformat(),
            "updated_at": d["updated_at"].isoformat()
        } for d in drafts]
    })

@app.route("/saveDraft", methods=["POST"])
def save_draft():
    data = request.get_json()
    username = data["username"]
    draft_id = data.get("draftId")
    
    draft_data = {
        "username": username,
        "title": data["title"],
        "draft": data["draft"],
        "depGraph": data["depGraph"],
        "editorState": data["editorState"],
        "flowSlice": data["flowSlice"],
        "editorSlice": data["editorSlice"],
        "introSlice": data["introSlice"],
        "condition": data["condition"],
        "updated_at": datetime.now()
    }
    
    try:
        if draft_id:  # Update existing draft
            result = db.drafts.update_one(
                {"_id": ObjectId(draft_id)},
                {"$set": draft_data}
            )
            if result.modified_count == 0:
                return jsonify({"status": "fail", "message": "Draft not found"})
        else:  # Create new draft
            draft_data["created_at"] = datetime.now()
            db.drafts.insert_one(draft_data)
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)})

def implementSupportingArgument(supportingArgument, argumentSupported):

    if test:
        return "This is a test mode response (SA)"

    messages = [
        {"role": "system", "content": "You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to support an argument by considering a provided supporting argument."},
        {"role": "user", "content": f'''Please write a paragraph that supports the argument: "{argumentSupported}" by realizing the following kind of supporting evidence: "{supportingArgument}"'''},
    ]

    # prompt = f'''Please list the counter arguments that can challenge the argument: "Houston is a good city because it has a convenient transportaion and afforable living cost"'''
    response = OpenAIClient.chat.completions.create(
        model=model_type,
        messages=messages,
        temperature=tempature,
        max_tokens=max_tokens
    )

    return response.choices[0].message.content.strip().replace("\n", " ")


def implementCounterArgument(keyword, counterArgument, argumentAttacked):

    print("called implementCounterArgument")

    if test:
        return "This is a test mode response (CA)"

    messages = [
        {"role": "system", "content": "You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to argue against an argument by considering a provided counter argument."},
        {"role": "user", "content": f'''Please write a paragraph that argues against the argument: "{argumentAttacked}" by considering the following counter argument: "{counterArgument}" from the perspective of {keyword}'''},
    ]

    # prompt = f'''Please list the counter arguments that can challenge the argument: "Houston is a good city because it has a convenient transportaion and afforable living cost"'''
    response = OpenAIClient.chat.completions.create(
        model=model_type,
        messages=messages,
        temperature=tempature,
        max_tokens=max_tokens
    )

    return response.choices[0].message.content.strip().replace("\n", " ")


def implementElaboration(prompt, context):

    if test:
        return "This is a test mode response (Elaboration)"

    messages = [
        {"role": "system", "content": f'''You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to elaborate on a particular given discussion point to support my argument.'''},
        {"role": "user", "content": f'''Please write a paragraph that elaborates on my argument "{context}" by considering the following discussion point "{prompt}":'''}
    ]

    response = OpenAIClient.chat.completions.create(
        model=model_type,
        messages=messages,
        temperature=tempature,
        max_tokens=max_tokens
    )

    return response.choices[0].message.content.strip().replace("\n", " ")


def generateStartingSentence(keyword, discussionPoints, globalContext):

    if test:
        return "This is a test mode response (Starting Sentence)"

    messages = [
        {"role": "system", "content": f'''You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to write a starting sentence of the paragraph that support user's argument from a particular perspective.'''},
        {"role": "user", "content": f'''Write a starting sentence for the paragraph that elaborates on the argument {globalContext} from the perspective of {keyword}'''}
    ]

    response = OpenAIClient.chat.completions.create(
        model=model_type,
        messages=messages,
        temperature=tempature,
        max_tokens=max_tokens
    )

    return response.choices[0].message.content.strip().replace("\n", " ")


@app.route("/implementTopicSentence", methods=["POST"])
def implementTopicSentence():
    if test:
        return "This is a test mode response (Topic Sentence)"

    response = request.get_json()
    prompt = response['prompt']

    messages = [
        {"role": "system", "content": f'''You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to elaborate on a particular given discussion point to support my argument.'''},
        {"role": "user", "content": f'''Please write a sentence that claim my argument "{prompt}":'''}
    ]

    response = OpenAIClient.chat.completions.create(
        model=model_type,
        messages=messages,
        temperature=tempature,
        max_tokens=max_tokens
    )

    res = {
            "response": response.choices[0].message.content.strip().replace("\n", " ")
    }

    return jsonify(res)


def generateTopicSentence(prompt, context):
    if test:
        return "This is a test mode response (Elaboration)"

    messages = [
        {"role": "system", "content": f'''You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to elaborate on a particular given discussion point to support my argument.'''},
        {"role": "user", "content": f'''Please write a sentence that claim my argument "{prompt}":'''}
    ]

    response = OpenAIClient.chat.completions.create(
        model=model_type,
        messages=messages,
        temperature=tempature,
        max_tokens=max_tokens
    )

    return response.choices[0].message.content.strip().replace("\n", " ")

@app.route("/implementCounterArgument", methods=["POST"])
def gpt_implement_counter_argument():

    if test:
        return "This is a test mode response (Starting Sentence)"

    if request.method == "POST":
        response = request.get_json()
        counterArgument = response["prompt"]
        argumentAttacked = response["context"]

        messages = [
            {"role": "system", "content": "You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to argue against an argument by considering a provided counter argument."},
            {"role": "user", "content": f'''Plesae write a paragraph that argues against the argument: "{argumentAttacked}" by considering the following counter argument: "{counterArgument}"'''},
        ]

        # prompt = f'''Please list the counter arguments that can challenge the argument: "Houston is a good city because it has a convenient transportaion and afforable living cost"'''
        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = {
            "response": response.choices[0].message.content.strip().replace("\n", " ")
        }

        return jsonify(res)


@app.route("/implementSupportingArgument", methods=["POST"])
def gpt_implement_supporting_argument():

    if test:
        return "This is a test mode response (Starting Sentence)"

    if request.method == "POST":
        response = request.get_json()
        supportingArgument = response["prompt"]
        argumentSupported = response["context"]

        messages = [
            {"role": "system", "content": "You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to support an argument by considering a provided supporting argument."},
            {"role": "user", "content": f'''Please write a paragraph that supports the argument: "{argumentSupported}" by realizing the following kind of supporting evidence: "{supportingArgument}"'''},
        ]

        # prompt = f'''Please list the counter arguments that can challenge the argument: "Houston is a good city because it has a convenient transportaion and afforable living cost"'''
        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = {
            "response": response.choices[0].message.content.strip().replace("\n", " ")
        }

        return jsonify(res)


@app.route("/implementElaboration", methods=["POST"])
def gpt_implement_elaboration():

    if test:
        return "This is a test mode response (Starting Sentence)"

    if request.method == "POST":
        response = request.get_json()
        prompt = response["prompt"]
        context = response["context"]

        messages = [
            {"role": "system", "content": f'''You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to elaborate on a particular given discussion point to support my argument.'''},
            {"role": "user", "content": f'''Please write a paragraph that elaborates on my argument "{context}" by considering the following discussion point "{prompt}":'''}
        ]

        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = {
            "response": response.choices[0].message.content.strip().replace("\n", " ")
        }

        return jsonify(res)


@app.route("/implementKeyword", methods=["POST"])
def gpt_keyword_sentence():

    if test:
        return "This is a test mode response (Starting Sentence)"

    if request.method == "POST":
        response = request.get_json()
        prompt = response["prompt"]
        context = response["context"]

        print("[implement keyword] request: ", response)

        messages = [
            {"role": "system", "content": f'''You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to write a starting sentence of the paragrah that support user's argument from a particular perspective.'''},
            {"role": "user", "content": f'''Write a starting sentence for the paragraph that elaborates on the argument {context} from the perspective of {prompt}'''}
        ]

        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = {
            "response": response.choices[0].message.content.strip().replace("\n", " ")
        }

        return jsonify(res)


@app.route("/", methods=["GET", "POST"])
def gpt_inference():
    if request.method == "GET":
        prompt = request.args.get("prompt")
        response = OpenAIClient.chat.completions.create(
            model=model_type,
            prompt=prompt,
            temperature=tempature,
            max_tokens=max_tokens
        )
        print(f"response: {response.choices[0].text}")
        res = {
            "response": response.choices[0].text.strip()
        }
        return jsonify(res)

@app.route("/keyword2", methods=["POST"])
def keyword():
    if request.method == "POST":
        response = request.get_json()
        prompt = response["prompt"]

        res = {
                "response": prompt
            }
        return jsonify(res)


@app.route("/keyword", methods=["POST"])
def gpt_fetch_keywords():

    print("[keyword] request: ", request)
    # test mode
    if test == True:
        return jsonify({"response": ["Quality of life", "Economy", "Population", "Education", "Location", "Safety", "Job opportunity"]})

    if request.method == "POST":
        response = request.get_json()
        prompt = response["prompt"]

#         elaborate_example = '''
# Aspects for for elaborating: "Houston is a good city":
# 1. Quality of life
# 2. Economy
# 3. Population
# 4. Education
# 5. Location
# 6. Safety
# 7. Job opportunity

# Aspects for elaborating: "Computer Science is a good major":
# 1. Social demand
# 2. Job opportunity
# 3. Promise
# 4. Salary
# 5. Enrollment
# 6. Popularity
# 7. Job security
#         '''

#         evidence_example = '''
# Types of evidence for supporting: "South Bend is a great city to live in in terms of cost of living":
# 1. Cost of living index
# 2. Average rent prices
# 3. Cost of goods and services
# 4. Average salary
# 5. Testimonials
# 6. Job opportunities
#         '''

        print(f"prompt: {prompt}")

        messages = [
            {"role": "system", "content": "You are a helpful writing assistant. You are given a argument and need to think of key aspects to elaborate on or evidence to support the argument."},
            {"role": "user", "content": '''Please list key aspects that are worth to discuss in order to support argument: "Houston is a good city"'''},
            {"role": "assistant", "content": '''
1. Quality of life
2. Economy
3. Population
4. Education
5. Location
6. Safety
7. Job opportunity'''},
            {"role": "user", "content": '''Please list key aspects that are worth to discuss in order to support argument: "Computer Science is a good major"'''},
            {"role": "assistant", "content": '''
1. Social demand
2. Job opportunity
3. Promise
4. Salary
5. Enrollment
6. Popularity
7. Job security'''},
            {"role": "user", "content": f'''Please list key aspects that are worth to discuss in order to support argument: "{prompt}"'''},
        ]

        # if mode == "elaborate":
        #     prompt = elaborate_example + "\n\n" + "Aspects for elaborating: " + prompt
        # if mode == "evidence":
        #     prompt = evidence_example + "\n\n" + "Types of evidence for supporting: " + prompt

        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = response.choices[0].message.content.strip()

        print(f"response: {res}")
        keywords = []
        # get the keyword part of the response
        res = res.strip().splitlines()
        for index, r in enumerate(res):
            if len(r) == 0:
                continue
            if index == 0 and not r[0].isdigit():
                continue
            pattern = r"^\d{1,2}. ?(.*)|^- ?(.*)|(.*)"
            # only consider the first match, findall returns the matched part for each group in the first match
            keyword = re.findall(pattern, r)[0]
            keyword = [k for k in keyword if len(k) > 0][0]

            if keyword is None:
                continue

            if any(x in [":", "-"] for x in keyword):
                keyword = keyword.split(":")[0]
            keywords.append(keyword)

        print(f"returned keywords: {keywords}")

        res = {
            "response": keywords
        }
        return jsonify(res)


@app.route("/prompts", methods=["POST"])
def gpt_fetch_prompts():
    if request.method == "POST":
        response = request.get_json()
        keywords = response["keywords"]
        context = response["context"]

        prompts = []
        res = []

        print("[prompts] request: " + str(response))

        # test mode

        if test == True:
            res = []
            for key in keywords:
                res.append(
                    {"keyword": key, "prompt": "What is the relationship between " + key + " and " + context + "?"})
            return jsonify({"response": res})

        # dev mode
        for key in keywords:

            messages = [
                {"role": "system", "content": "You are a helpful writing assistant. You are given a pair of argument and perspective, you need to think of key discussion points from the perspective to support the given argument."},
                {"role": "user", "content": '''Please list key discussion points that are worth to include in order to support arguemnt: "Houston is a good city" from perspective of transportation'''},
                {"role": "assistant", "content": f'''
1. Public transportation system in Houston
2. Initiatives or plans to improve the public transportation infrastructure in Houston
3. Bicycle or walking paths that connect the different parts of the city
4. Convenience to get around Houston without a car
5. Public affordable transportation options
6. Transportation options that can help reduce traffic congestion in Houston'''},
                {"role": "user", "content": '''Please list key discussion points that are worth to include in order to support arguemnt: "Notre Dame is a great school to attend" from perspective of academic exllenence'''},
                {"role": "assistant", "content": f'''
1.High quality educational programs and curricula
2. Low student-to-faculty ratio
3. Research opportunities and resources
4. Extracurricular activities
5. Access to specialized facilities
6. Highly qualified and experienced faculty members'''},
                {"role": "user", "content": f'''Please list key discussion points that are worth to include in order to support arguemnt: "{context}" from perspective of {key}'''},
            ]

            response = OpenAIClient.chat.completions.create(
                model=model_type,
                messages=messages,
                temperature=tempature,
                max_tokens=max_tokens
            )
            print(
                f"DP response: {response.choices[0].message.content.strip()}")

            res = response.choices[0].message.content.strip().splitlines()
            for index, r in enumerate(res):
                if len(r) == 0:
                    continue
                if index == 0 and (not r[0].isdigit() or r[0] != "-"):
                    continue
                # print(f"Line: {r}")
                pattern = r"^\d{1,2}. ?(.*)|^- ?(.*)|(.*)"
                prompt = re.findall(pattern, r)[0]
                prompt = [p for p in prompt if len(p) > 0][0]
                if any(x in [":", "-"] for x in prompt):
                    prompt = prompt.split(":")[0]
                prompts.append({"keyword": key, "prompt": prompt})

            res = {
                "response": prompts
            }
        return jsonify(res)


@app.route("/rewrite", methods=["POST"])
def gpt_rewrite():
    if request.method == "POST":
        response = request.get_json()
        print("response: ", response)

        mode = response["mode"]
        curSent = response["curSent"]

        print("[rewrite] request: ", response)

        if test:
            return "This is a test mode response (Starting Sentence)"

        res = {}

        if mode == "alternative":

            prompt = response["basePrompt"]

            messages = [
                {"role": "system", "content": "You are a helpful writing assistant. You are trying to rephrase a sentence in a different way."},
                {"role": "user", "content": f"Rephrase the following sentence in a different way: {curSent}"}
            ]

            prompt = f"Rephrase the following sentence in a different way: {curSent}"
            print(f"[/rewrite] prompt: {prompt}")
            response = OpenAIClient.chat.completions.create(
                model=model_type,
                messages=messages,
                temperature=tempature,
                max_tokens=max_tokens,
                n=8
            )

            candidates = [response.choices[i].message.content.strip().replace("\n", "")
                          for i in range(min(8, len(response.choices)))]
            res["candidates"] = candidates

        if mode == "refine":

            furInstruction = response["furInstruction"]

            messages = [
                {"role": "system", "content": "You are a helpful writing assistant. You are trying to refine a sentence with user instruction."},
                {"role": "user", "content": f'''Rephrase the following sentence "{curSent}" with the instruction: "{furInstruction}"'''}
            ]

            response = OpenAIClient.chat.completions.create(
                model=model_type,
                messages=messages,
                temperature=tempature,
                max_tokens=max_tokens,
                n=8
            )

            candidates = [response.choices[i].message.content.strip().replace("\n", "")
                          for i in range(min(8, len(response.choices)))]
            res["candidates"] = candidates

        if mode == "fix":
            weaknesses = response["weaknesses"]
            messages = [
                {"role": "system", "content": "You are a helpful writing assistant. You are trying to fix the mentioned logical weaknesses in my argument."},
                {"role": "user",
                    "content": f'''I just made an argument: {curSent}. I know this argument has the following logical weaknesses: {"; ".join(weaknesses)}. Rewrite the argument to fix the logical weaknesses.'''''}
            ]

            response = OpenAIClient.chat.completions.create(
                model=model_type,
                messages=messages,
                temperature=tempature,
                max_tokens=max_tokens,
                n=8
            )

            candidates = [response.choices[i].message.content.strip().replace("\n", "")
                          for i in range(min(8, len(response.choices)))]

            candidates = [c.split(":")[1] if ":" in c else c for c in candidates]
            res["candidates"] = candidates

        print("fix res:", res["candidates"])

        return jsonify(res)


@app.route("/getWeakness", methods=["POST"])
def gpt_weakness_type():
    req = request.get_json()
    print(req)

    # test mode
    if test == True:
        return jsonify({"response": ["Quality of life", "Economy", "Population", "Education", "Location", "Safety", "Job opportunity"]})

    prompt = req["context"]

    elaborate_example = '''
Based on the argumentation theory, find logical weaknesses of the argument: "Houston is a good city to live in because it has convenient transportation"
1. Lack of evidence: The argument does not provide any evidence to support the claim that Houston has convenient transportation. This lack of evidence weakens the argument's credibility.
2. Ambiguity: The argument does not clearly define what is meant by "convenient transportation." Does it refer to public transportation, highways, or something else? The lack of clarity weakens the argument.
3. Overgeneralization: The argument assumes that one aspect of a city (transportation) is enough to make it a "good" place to live in. This overgeneralization ignores other important factors such as cost of living, crime rates, job opportunities, and climate.
4. Lack of comparison: The argument does not compare Houston's transportation system to other cities. Without a comparison, it is difficult to determine if Houston's transportation is indeed convenient, or if it is just average or below average.
5. False premise: The argument assumes that convenient transportation is the most important factor for determining whether a city is "good" to live in. However, this may not be true for everyone. Some people may prioritize other factors such as cultural events, education, or community services.
6. Hasty conclusion: The argument jumps to the conclusion that Houston is a "good" city to live in based on only one factor, without fully considering all other factors that contribute to overall quality of life in a city.

Based on the argumentation theory, find logical weaknesses of the argument: "Notre Dame is a great school to attend because it has outstanding faculty"
1. Hasty generalization: The argument jumps to the conclusion that Notre Dame is a great school to attend based on only one factor, outstanding faculty, without fully considering all other factors that contribute to a school being great.
2. False cause: The argument implies that Notre Dame's greatness as a school is solely due to its outstanding faculty, without considering other important factors that contribute to a school's overall quality, such as facilities, resources, and student life.
3. Lack of evidence: The argument does not provide any evidence to support the claim that Notre Dame has outstanding faculty, making the argument's credibility weaker.
4. Ambiguity: The argument does not clearly define what is meant by "outstanding faculty." Does it refer to faculty members' research, teaching abilities, or something else? The lack of clarity weakens the argument.
5. Overgeneralization: The argument assumes that one aspect of a school (faculty) is enough to make it a "great" school to attend. This overgeneralization ignores other important factors such as tuition, campus life, location, and student resources.
6. False dichotomy: The argument presents a false dichotomy by implying that a school is either great or not great based solely on the quality of its faculty. This ignores the fact that there can be schools with great faculty that are not considered great overall due to other factors.
7. Subjectivity: The argument's claim that Notre Dame is a great school to attend is subjective and depends on individual opinions and preferences. What one person considers a great school may not be the same for another person.
8. Lack of specificity: The argument does not provide specific information about what makes Notre Dame's faculty outstanding, such as their teaching skills, research experience, or expertise in certain fields. This lack of specificity weakens the argument's claim that Notre Dame has outstanding faculty.
        '''

#     evidence_example = '''
# Types of evidence for supporting: "South Bend is a great city to live in in terms of cost of living":
# 1. Cost of living index
# 2. Average rent prices
# 3. Cost of goods and services
# 4. Average salary
# 5. Testimonials
# 6. Job opportunities
#         '''

    messages = [
        {"role": "system", "content": "You are a helpful writing assistant. You are trying to find logical weaknesses of the argument."},
        {"role": "user", "content": f"Find logical weaknesses of the argument: Houston is a good city to live in because it has convenient transportation"},
        {"role": "assistant", "content": '''
1. Lack of evidence: The argument does not provide any evidence to support the claim that Houston has convenient transportation. This lack of evidence weakens the argument's credibility.
2. Ambiguity: The argument does not clearly define what is meant by "convenient transportation." Does it refer to public transportation, highways, or something else? The lack of clarity weakens the argument.
3. Overgeneralization: The argument assumes that one aspect of a city (transportation) is enough to make it a "good" place to live in. This overgeneralization ignores other important factors such as cost of living, crime rates, job opportunities, and climate.
4. Lack of comparison: The argument does not compare Houston's transportation system to other cities. Without a comparison, it is difficult to determine if Houston's transportation is indeed convenient, or if it is just average or below average.
5. False premise: The argument assumes that convenient transportation is the most important factor for determining whether a city is "good" to live in. However, this may not be true for everyone. Some people may prioritize other factors such as cultural events, education, or community services.
6. Hasty conclusion: The argument jumps to the conclusion that Houston is a "good" city to live in based on only one factor, without fully considering all other factors that contribute to overall quality of life in a city.'''},
        {"role": "user", "content": "Find logical weaknesses of the argument: Notre Dame is a great school to attend because it has outstanding faculty"},
        {"role": "assistant", "content": '''
1. Hasty generalization: The argument jumps to the conclusion that Notre Dame is a great school to attend based on only one factor, outstanding faculty, without fully considering all other factors that contribute to a school being great.
2. False cause: The argument implies that Notre Dame's greatness as a school is solely due to its outstanding faculty, without considering other important factors that contribute to a school's overall quality, such as facilities, resources, and student life.
3. Lack of evidence: The argument does not provide any evidence to support the claim that Notre Dame has outstanding faculty, making the argument's credibility weaker.
4. Ambiguity: The argument does not clearly define what is meant by "outstanding faculty." Does it refer to faculty members' research, teaching abilities, or something else? The lack of clarity weakens the argument.
5. Overgeneralization: The argument assumes that one aspect of a school (faculty) is enough to make it a "great" school to attend. This overgeneralization ignores other important factors such as tuition, campus life, location, and student resources.
6. False dichotomy: The argument presents a false dichotomy by implying that a school is either great or not great based solely on the quality of its faculty. This ignores the fact that there can be schools with great faculty that are not considered great overall due to other factors.
7. Subjectivity: The argument's claim that Notre Dame is a great school to attend is subjective and depends on individual opinions and preferences. What one person considers a great school may not be the same for another person.
8. Lack of specificity: The argument does not provide specific information about what makes Notre Dame's faculty outstanding, such as their teaching skills, research experience, or expertise in certain fields. This lack of specificity weakens the argument's claim that Notre Dame has outstanding faculty.'''},
        {"role": "user", "content": f"Find logical weaknesses of the argument: {prompt}"},
    ]

    prompt = elaborate_example + "\n\n" + \
        f'''Based on the argumentation theory, find logical weaknesses of the argument: "Notre Dame is a great school to attend because it has outstanding faculty"'''

    response = OpenAIClient.chat.completions.create(
        model=model_type,
        messages=messages,
        temperature=tempature,
        max_tokens=max_tokens
    )

    output = response.choices[0].message.content.strip().replace("\n\n", "\n")
    output = output.splitlines()

    resData = []

    pattern = r"^\d{1,2}. ?(.*)|^- ?(.*)|(.*)"
    for i in range(len(output)):
        if output[i][0].isdigit():
            matchedText = re.findall(pattern, output[i])[0]
            resData.append(matchedText[0])
        else:
            if ":" in output[i] and output[i][-1] != ":":
                resData.append(output[i].split(":")[1].strip())

    res = {"response": resData}
    return jsonify(res)


@app.route("/supportingArguments", methods=["POST"])
def gpt_supporting_argument():
    if request.method == "POST":
        response = request.get_json()
        context = response["context"]

        # test mode
        if test == True:
            return jsonify({"response": ["Quality of life", "Economy", "Population", "Education", "Location", "Safety", "Job opportunity"]})

        messages = [
            {"role": "system", "content": "You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to raise the supporting arguments or evidences for the given argument."},
            {"role": "user", "content": '''Please list kinds of supporting arguments or evidences that can increase the credibility of the argument: "The potential for computer scientists to create new technologies and applications that can change the world is immense. Computer science is a field that is constantly evolving, and its practitioners are tasked with finding new and innovative ways to solve problems and improve existing systems. From developing new software and applications to designing cutting-edge hardware, computer scientists have the ability to create products that can have a profound impact on society. For example, the rise of the internet and the rapid development of social media platforms have revolutionized the way people communicate and interact with one another. Similarly, advancements in artificial intelligence and machine learning have the potential to transform industries such as healthcare, transportation, and finance. In short, computer science is a field that offers unparalleled opportunities for innovation and has the potential to shape the future in profound ways."'''},
            {"role": "assistant", "content": '''
1. Statistics: Using statistical data to support the argument can improve its credibility. For instance, citing the percentage of computer scientists who have created technologies that have positively impacted society.
2. Expert opinion: Quoting respected experts or professionals in the field can lend credibility to the argument. For instance, referencing interviews with renowned computer scientists who have spoken about the potential of computer science to shape the future.
3. Historical examples: Citing historical examples of how computer science has influenced society can provide support for the argument. For example, referencing the development of the World Wide Web and how it has revolutionized the way people access and share information.
4. Case studies: Providing case studies of successful innovations in computer science can also bolster the argument. For example, discussing how machine learning algorithms have improved patient outcomes in the healthcare industry.
5. Research findings: Referring to recent research findings in computer science can add credibility to the argument. For example, citing studies that demonstrate how computer science is contributing to the advancement of various industries.
6. Personal experiences: Sharing personal experiences or anecdotes about the impact of computer science on society can help make the argument more relatable and compelling.
7. Comparisons: Making comparisons to other fields or technologies can also enhance the credibility of the argument. For example, comparing the potential impact of computer science to that of other technological breakthroughs like the invention of the printing press or the steam engine.
8. Real-world examples: Providing real-world examples of the impact of computer science on society can make the argument more tangible. For instance, discussing how social media has transformed the way people connect with each other or how self-driving cars are set to revolutionize the transportation industry.
9 Future projections: Discussing potential future developments in computer science and their potential impact on society can help bolster the argument. For example, speculating on the possibilities of a future where artificial intelligence is used to solve some of the world's most pressing problems.'''},
            {"role": "user", "content": f'''Please list kinds of supporting arguments or evidences that can increase the credibility of the argument: {context}"'''},
        ]

        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = response.choices[0].message.content.strip()
        res = res.strip().splitlines()
        return jsonify({"response": res})


@app.route("/counterArguments", methods=["POST"])
def gpt_counter_argument():
    if request.method == "POST":
        response = request.get_json()
        context = response["context"]
        keyword = response["keyword"]

        # test mode
        if test == True:
            return jsonify({"response": ["Quality of life", "Economy", "Population", "Education", "Location", "Safety", "Job opportunity"]})

        messages = [
            {"role": "system", "content": "You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to raise the counter arguments for the given statement."},
            {"role": "user", "content": '''Please list the counter arguments that can challenge the argument: "Houston is a good city because it has a convenient transportaion and afforable living cost from the perspective of transportation"'''},
            {"role": "assistant", "content": '''
1. Lack of Comprehensive Public Transportation System: While Houston has public transportation options such as buses and light rail, the public transportation system is not comprehensive, and many areas of the city may not be well-served by these options. This can limit accessibility to jobs and other important destinations for residents who rely on public transportation.
2. Inadequate Bike Infrastructure: Houston has a relatively low bike score, indicating that the city's bike infrastructure may not be adequate for residents who prefer to bike for transportation. This can limit mobility options for some residents, particularly those who may not have access to a car
3. High Traffic Congestion: Despite having convenient transportation options, Houston is known for its high traffic congestion, particularly during rush hour. This can cause significant delays for commuters, particularly those who rely on public transportation or who must travel long distances to reach their destinations.
4. Poor Air Quality: Traffic congestion and other factors can contribute to poor air quality in Houston, which can have negative health effects on residents. This can be a particular concern for vulnerable populations such as children, the elderly, and those with respiratory problems.
5. Limited Options for Alternative Transportation: While Houston has some options for alternative transportation, such as bike sharing and car sharing programs, these options may not be widely available or accessible to all residents.
6. Lack of Walkability: Many areas of Houston are designed primarily for cars, which can make it difficult for residents to walk to their destinations. This can limit opportunities for exercise and may contribute to obesity and other health problems.'''},
            {"role": "user", "content": f'''Please list the counter arguments that can challenge the argument: "{context}" from the perspective of "{keyword}. Directly list the counter arguments, do not include any prefix sentence."'''},
        ]

        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = response.choices[0].message.content.strip()
        res = res.strip().splitlines()

        res = [ r for r in res if len(r) > 0 and r[0].isdigit()]

        return jsonify({"response": res})


# depdentency graph data structure:
'''
DepGraph = {
    "FlowNodeKey1": {
        "type": "type of relation with the parent node",
        "prompt": "prompt of the node / content of the corresponding node in the flow graph",
        "children": ["FlowNodeKey2", "FlowNodeKey3", ...] // list of children nodes,
        "isImplemented": whether or not the corresponding text has been generated for this node
        "parent": key of the parent node,
        "text": concrete text generated for this node, only those implemented nodes have this field
    },
    "FlowNodeKey2": {
        ...
    }
}
'''


@app.route("/completion", methods=["POST"])
def gpt_completion():
    if request.method == "POST":
        response = request.get_json()
        prompt = response["prompt"]
        print("compltion prompt: ", prompt)
        # test mode
        if test == True:
            return jsonify({"response": "The answer is 42."})

        messages = [
            {"role": "system", "content": "You are a helpful writing assistant focusing on argumentative essay tutoring. You are trying to complete the given prompt."},
            {"role": "user", "content": f'''Please complete the following prompt: "{prompt}"'''},
        ]

        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = response.choices[0].message.content.strip()
        return jsonify({"completion": " "+res})

# generate text based on the given dependency graph


@app.route("/generateFromDepGraph", methods=["POST"])
def generateText():
    if request.method == "POST":
        response = request.get_json()
        depGraph = response["dependencyGraph"]
        # The flowNode key of the root of the dependency graph, which is usually a node that is already implemented
        rootKeys = response["rootKeys"]

        output = {}

        if len(rootKeys) == 0:
            output["error"] = "The root does not exist in the dependency graph"
            print("The root does not exist in the dependency graph")
            return jsonify(output)



        # generate text through BFS traversal
        visited = []
        queue = [root for root in rootKeys]

        print("dependency graph: ", depGraph)
        print("queue: ", queue)

        while queue:
            node = queue.pop(0)
            print("Current node: ", node)
            if node not in visited:
                if node not in depGraph:
                    raise Exception(
                        f"The node {node} does not exist in the dependency graph")
                visited.append(node)
                queue.extend(depGraph[node]["children"])
                print("visiting node: ", node)
                if not depGraph[node]["isImplemented"] or depGraph[node]["needsUpdate"]:
                    print("Unimplemented node: ", depGraph[node])
                    generation = None
                    # generate text for this node
                    prompt = depGraph[node]["prompt"]
                    parentKey = depGraph[node]["parent"]
                    if depGraph[node]["type"] != "root" and parentKey not in depGraph:
                        print("parent does not exist in graph")
                        output["error"] = "parent does not exist in graph"
                        output["depGraph"] = depGraph
                        return jsonify(output) 
                    parent = depGraph[parentKey] if depGraph[node]["type"] != "root" else None
                    # ASSUMPTION: the parent node is always implemented before its children
                    if depGraph[node]["type"] == "attackedBy":
                        # generate counter argument against the parent node

                        keywordNode = node
                        while (depGraph[keywordNode]["type"] != "featuredBy"):
                            keywordNode = depGraph[keywordNode]["parent"]

                        generation = implementCounterArgument(
                            depGraph[keywordNode]["prompt"], depGraph[node]["prompt"], parent["text"])
    
                        
                    elif depGraph[node]["type"] == "elaboratedBy":
                        # generate elaboration of the parent node
                        generation = implementElaboration(
                            prompt, parent["text"])
                    
                    elif depGraph[node]["type"] == "featuredBy":
                        # generate the starting sentence for the paragraph that this keyword is featured in
                        keyword = depGraph[node]["prompt"]
                        dps = [depGraph[dp_key]["prompt"]
                               for dp_key in depGraph[node]["children"]]
                        generation = generateStartingSentence(
                            keyword, dps, parent["text"])
                    elif depGraph[node]["type"] == "supportedBy":
                        # generate support for the parent node
                        generation = implementSupportingArgument(
                            prompt, parent["text"])
                    elif depGraph[node]["type"] == "root":
                        generation = generateTopicSentence(
                            depGraph[node]["prompt"], depGraph[node]["text"]
                        )

                    print(f"node: {node}, text: {generation}")
                    depGraph[node]["text"] = generation

        output["depGraph"] = depGraph
        print("generateFromDepGraph returned")
        return jsonify(output) 


@app.route("/generateFromSketch", methods=["POST"])
def get_generate_from_sketch():
    if request.method == "POST":
        response = request.get_json()
        globalContext = response["selectedPrompts"]
        keywords = response["keywords"]
        discussionPoints = response["discussionPoints"]
        depGraph = response["dependencyGraph"]

        print(f"depGraph: {depGraph}")

        output = {
            "keywords": keywords,
            "globalContext": globalContext,
            "discussionPoints": discussionPoints,
            "depGraph": depGraph,
            "startSents": {},
        }

        # test mode
        if test == True:
            generations = {}
            for k in keywords:
                if depGraph.get(k) is None or len(depGraph[k]) == 0:
                    continue
                for dp in depGraph[k]:
                    generations[dp["prompt"]
                                ] = "This is a test generation for " + dp["prompt"]
            output["generations"] = generations
            return jsonify(output)

        generations = {}

        for keyword in keywords:
            if depGraph.get(keyword) is None or len(depGraph[keyword]) == 0:
                continue
            startSent = generateStartingSentence(
                keyword, [d["prompt"] for d in depGraph[keyword]], globalContext)
            output["startSents"][keyword] = startSent
            for dp in depGraph[keyword]:
                gpt_prompt = f'''Please elaborate the argument "${globalContext}" from the perspective of ${keyword} by considering the following questions: ${dp["content"]}'''

                response = OpenAIClient.chat.completions.create(
                    model=model_type,
                    prompt=gpt_prompt,
                    temperature=tempature,
                    max_tokens=max_tokens
                )
                generations[dp["prompt"]] = response.choices[0].text.strip()

        output["generations"] = generations
        return jsonify(output)

@app.route("/synthesize", methods=["POST"])
def synthesize_thesis():
    if request.method == "POST":
        response = request.get_json()

        keyPoints = response["keyPoints"]
        keyPointsSentence = ""

        for index, point in enumerate(keyPoints, 1):
            keyPointsSentence += f"{index}. {point}\n"
        
        print("key point sentence is", keyPointsSentence)
        messages = [
            {"role": "system", "content": "You are a helpful writing assistant. Your student has gathered several key points/facts, but he cannot see the bigger picture of these ideas. Therefore, you are given those key points/facts, and you need to think of the thesis statement that introduces the main topic and purpose of those key points/facts."},
            {"role": "user", "content": '''Here are several separate key points:
1. In healthcare, AI algorithms can analyze medical data to provide accurate diagnoses and personalized treatment plans, while machine learning models predict disease outbreaks, enabling preventative measures. Additionally, robotic surgery, powered by AI, offers precision and reduces recovery time for patients.
2. For sustainable development, AI optimizes the performance and efficiency of renewable energy sources like wind and solar power. Smart grids, managed by AI, balance energy supply and demand, reducing wastage. Furthermore, predictive maintenance, facilitated by AI, minimizes downtime and repair costs for renewable energy infrastructure.
3. In education, AI-driven personalized learning platforms adapt to individual student needs, enhancing learning outcomes. Virtual tutors, powered by AI, provide round-the-clock assistance and support to students. Data analytics in education helps identify areas where students struggle, allowing for targeted interventions.

Please synthesize these key points into a cohesive thesis statement.'''},
            {"role": "assistant", "content":"The integration of artificial intelligence (AI) into various sectors can lead to significant advancements in healthcare, sustainable development through renewable energy, and education technology, ultimately transforming society."},
            {"role": "user", "content":f'''Here are several separate key points:
             {keyPointsSentence}
Please synthesize these key points into a cohesive thesis statement.'''}
        ]

        response = OpenAIClient.chat.completions.create(
            model=model_type,
            messages=messages,
            temperature=tempature,
            max_tokens=max_tokens
        )

        res = response.choices[0].message.content.strip()

        response = {"response": res}
        return jsonify(response)

@app.route("/user/<user_id>", methods=["GET", "PUT"])
def user_profile(user_id):
    if request.method == "GET":
        try:
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return jsonify({"status": "fail", "message": "User not found"}), 404

            user_data = {
                "username": user["username"],
                "full_name": user.get("full_name", ""),
                "role": user["role"],
                "students": []
            }

            if user["role"] == "teacher":
                # Get students for teacher
                students = list(db.users.find({"teacher_id": ObjectId(user_id)}))
                user_data["students"] = [{
                    "id": str(student["_id"]),
                    "username": student["username"]
                } for student in students]

            return jsonify({
                "status": "success",
                "user": user_data
            })
        except Exception as e:
            print(f"Error in user_profile: {str(e)}")
            return jsonify({"status": "fail", "message": str(e)}), 500
    elif request.method == "PUT":
        try:
            data = request.get_json()
            full_name = data.get("full_name")
            
            result = db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"full_name": full_name}}
            )
            
            if result.modified_count > 0:
                return jsonify({
                    "status": "success",
                    "message": "Profile updated successfully"
                })
            return jsonify({"status": "fail", "message": "No changes made"}), 400
            
        except Exception as e:
            print(f"Error updating user profile: {str(e)}")
            return jsonify({"status": "fail", "message": str(e)}), 500

@app.route("/teacher/<teacher_id>/students", methods=["POST"])
def add_student(teacher_id):
    data = request.get_json()
    student = db.users.find_one({"username": data["username"], "role": "student"})
    if not student:
        return jsonify({"status": "fail", "message": "Student not found"}), 404
    result = db.users.update_one(
        {"_id": student["_id"]},
        {"$set": {"teacher_id": ObjectId(teacher_id)}}
    )
    if result.modified_count > 0:
        return jsonify({
            "status": "success",
            "student": {
                "id": str(student["_id"]),
                "username": student["username"]
            }
        })
    return jsonify({"status": "fail", "message": "Failed to add student"})

@app.route("/teacher/<teacher_id>/students/<student_id>", methods=["DELETE"])
def remove_student(teacher_id, student_id):
    result = db.users.update_one(
        {"_id": ObjectId(student_id), "teacher_id": ObjectId(teacher_id)},
        {"$unset": {"teacher_id": ""}}
    )
    if result.modified_count > 0:
        return jsonify({"status": "success"})
    return jsonify({"status": "fail", "message": "Failed to remove student"})

@app.route("/teacher/classes", methods=["POST"])
def create_class():
    data = request.get_json()
    teacher_id = data.get("teacher_id")
    class_name = data.get("class_name")
    class_number = data.get("class_number")
    
    if not all([teacher_id, class_name, class_number]):
        return jsonify({"status": "fail", "message": "Missing required fields"}), 400
        
    # Check if class number already exists
    existing_class = db.classes.find_one({"class_number": class_number})
    if existing_class:
        return jsonify({"status": "fail", "message": "Class number already exists"}), 400
    
    class_id = ObjectId()
    new_class = {
        "_id": class_id,
        "teacher_id": ObjectId(teacher_id),
        "name": class_name,
        "class_number": class_number,
        "created_at": datetime.now()
    }
    
    try:
        db.classes.insert_one(new_class)
        return jsonify({
            "status": "success",
            "class": {
                "id": str(class_id),
                "name": class_name,
                "class_number": class_number
            }
        })
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@app.route("/teacher/classes/<class_id>", methods=["DELETE"])
def delete_class(class_id):
    try:
        result = db.classes.delete_one({"_id": ObjectId(class_id)})
        if result.deleted_count > 0:
            return jsonify({"status": "success"})
        return jsonify({"status": "fail", "message": "Class not found"}), 404
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@app.route("/teacher/<teacher_id>/classes", methods=["GET"])
def get_teacher_classes(teacher_id):
    try:
        classes = list(db.classes.find({"teacher_id": ObjectId(teacher_id)}))
        return jsonify({
            "status": "success",
            "classes": [{
                "id": str(c["_id"]),
                "name": c["name"],
                "class_number": c["class_number"]
            } for c in classes]
        })
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 500

@app.route("/check_username", methods=["POST"])
def check_username():
    data = request.get_json()
    username = data.get("username")
    if not username:
        return jsonify({"status": "fail", "message": "No username provided"}), 400
        
    user = db.users.find_one({"username": username})
    return jsonify({
        "status": "success",
        "exists": user is not None
    })

@app.route("/deleteDraft", methods=["POST"])
def delete_draft():
    if request.method == "POST":
        data = request.get_json()
        draft_id = data.get("draftId")
        username = data.get("username")
        
        if not all([draft_id, username]):
            return jsonify({"status": "fail", "message": "Missing required fields"}), 400
            
        try:
            result = db.drafts.delete_one({
                "_id": ObjectId(draft_id),
                "username": username
            })
            
            if result.deleted_count > 0:
                return jsonify({"status": "success"})
            return jsonify({"status": "fail", "message": "Draft not found"}), 404
            
        except Exception as e:
            return jsonify({"status": "fail", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000, host="127.0.0.1")
