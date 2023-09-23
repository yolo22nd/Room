package com.company.Objects;

import com.company.Base;

import java.util.Scanner;

public class PC extends Base {
    public String object = "   PC   ";
    public static String name = "a PC";
    public static int position=-10;

    public static void setPosition(int position) {
        PC.position = position;
    }

    public static void usePC() {
        bootUp();

        Scanner scanner = new Scanner(System.in);
        System.out.println("if you want to close,type 'close'");
        System.out.println("if you want to surf,type 'surf'");
        System.out.println("if you want to send a message,type 'message'");
        System.out.println("if you want to play a game,type 'play'");
        label:
        while (true){
            System.out.println("what would you like to do in PC");
            switch (scanner.nextLine()) {
                case "close":
                    break label;
                case "play":
                    play();
                    break;
                case "surf":
                    surf();
                    break;
                case "message":
                    message();
                    break;
                default:
                    System.out.println("sorry,your action was not recognised...try again");
                    break;
            }
        }
        System.out.println("PC closed");
    }

    public static void bootUp() {
        System.out.println("Power button pressed");
        System.out.println("home screen opened");
    }

    public static void play() {
        Scanner scanner=new Scanner(System.in);
        boolean won;
        System.out.println("you have chosen to play.\n" +
                "n we are going to play rock paper scissors.\n" +
                "press enter to continue...");
        scanner.nextLine();
        System.out.println("type rock paper or scissor when '1!,2!!,3!!!' is printed.\n" +
                "if you type anything else,you will automatically loose that round.\n" +
                "press enter after every round and also if nothing is happening.\n" +
                "the first to win 3 rounds wins.\n" +
                "press enter to continue...");
        scanner.nextLine();
        System.out.println("if you don't know how the game works\n" +
                "here's how...\n" +
                "paper covers rock\n" +
                "scissors cuts paper \n" +
                "rock crushes scissors\n" +
                "if both you n comp have the same objects,its a tie.");
        scanner.nextLine();
        System.out.println("now lets start!!!\n");
        won=startGame();
        if (won){
            System.out.println("you won!!!!!!!");
            System.out.println("congratulations,\n" +
                    "you have cleared the first half of the game...\n" +
                    "now here is your secret tip.\n" +
                    "\n" +
                    "'close the PC and type 'search' before moving from your position");
        }else System.out.println("you lost!!!!!!!!!!!!!");
    }

    private static boolean startGame() {
        Scanner scanner=new Scanner (System.in);
        boolean youWin=false;
        boolean notOver=true;
        int yourScore=0;
        int compScore=0;
        while (notOver) {
            System.out.println("1!, 2!!, 3!!! GO!!!!!");
            String yourMove = scanner.nextLine().toLowerCase();
            String response = response();
            switch (yourMove) {
                case "scissors":
                    if (response.equals("rock")) {compScore++;}

                    else if (response.equals("paper")) {yourScore++;}
                    break;
                case "paper":
                    if (response.equals("rock")) {yourScore++;}
                    else if (response.equals("scissors")) {compScore++;}
                    break;
                case "rock":
                    if (response.equals("scissors")) {yourScore++;}
                    else if (response.equals("paper")){compScore++;}
                    break;
                default:
                    compScore++;
                    System.out.println("your score: " + yourScore);
                    System.out.println("comp score: " + compScore);
                    System.out.println("type only 'rock', 'paper', or 'scissors'!!!!");
            }
            System.out.println("your             comp's\n" +
                    "move             move\n" +
                    " " + yourMove + "           " + response);
            System.out.println("\n");
            System.out.println("your score: " + yourScore);
            System.out.println("comp score: " + compScore);
            if (yourScore>=3||compScore>=3){
                notOver=false;
            }
            if (yourScore>=3){
                youWin=true;
            }
        }
        return youWin;
    }

    private static String response(){
        double randomNo=Math.random()*3;
        int newRandomNo= (int) Math.round(randomNo);
        switch (newRandomNo){
            case 1:
                return "rock";
            case 2:
                return "paper";
            default:
                return "scissors";
        }
    }

    public static void surf() {
        try{
            String url="http://www.google.com";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    public static void message() {
        try{
            String url="https://mail.google.com/mail/u/0/#inbox";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    @Override
    public void printMap(int position) {
        if (Cushion.position == position) {
            PC.position = position;
            Base.positionPC=position;
            setHere(object,position);
            super.printMap(position);
        }else {
            System.out.println("the PC broke from the impact of the ground");
            System.out.println("its pieces were everywhere.maybe keeping something below it \n" +
                    "to reduce the impact might help.");
        }
    }
}
