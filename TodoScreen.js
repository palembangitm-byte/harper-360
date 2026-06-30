import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, Button, Checkbox, Icon } from 'react-native-elements';

const TodoScreen = () => {
  const [task, setTask] = useState('');
  const [todoList, setTodoList] = useState([]);
  const navigation = useNavigation();

  const addTask = () => {
    if (task.trim().length > 0) {
      setTodoList([...todoList, { id: Date.now().toString(), text: task, completed: false }]);
      setTask('');
    }
  };

  const toggleTask = (id) => {
    setTodoList(todoList.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const deleteTask = (id) => {
    setTodoList(todoList.filter(item => item.id !== id));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Todo List</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a new task..."
          value={task}
          onChangeText={setTask}
        />
        <Button title="Add" onPress={addTask} buttonStyle={styles.addButton} />
      </View>
      <FlatList
        data={todoList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card containerStyle={styles.card}>
            <View style={styles.taskItem}>
              <Checkbox
                checked={item.completed}
                onPress={() => toggleTask(item.id)}
                checkedColor="#4CAF50"
              />
              <Text style={[styles.taskText, item.completed && styles.completedText]}>
                {item.text}
              </Text>
              <TouchableOpacity onPress={() => deleteTask(item.id)}>
                <Icon name="delete" color="#f44336" />
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />
      <Button
        title="Go back to Home"
        onPress={() => navigation.navigate('Home')}
        type="clear"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  addButton: {
    marginLeft: 10,
    backgroundColor: '#2196F3',
  },
  card: {
    margin: 0,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskText: {
    flex: 1,
    fontSize: 16,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
});

export default TodoScreen;
