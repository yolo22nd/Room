package com.company.Objects;

import com.company.Base;
import com.company.RoomsNDoors.TV;
import com.company.You;

import java.util.Scanner;

public class Chair extends Base {
    public String object = "  Chair ";
    public static String name = "a Chair";
    public static int position=-10;
    public static int facingPosition;
    public static String[] directionNames = new String[3];

    public static void turnChair(){
        Scanner scanner=new Scanner(System.in);
        System.out.println("do you want to turn your chair clockwise?\n" +
                "if yes, write yes.if anti-clockwise,\n" +
                "type anything other than 'yes'.");
        if (scanner.nextLine().toLowerCase().equals("yes")){
            turnChair(true);
        }else {
            turnChair(false);
        }
    }

    public static void turnChair(boolean clockwise){
        directionNames[0]="north";
        directionNames[1]="east";
        directionNames[2]="south";
        directionNames[3]="west";
        if (clockwise) {
            facingPosition++;
            if(facingPosition>3){
                facingPosition=0;
            }
        }else {
            facingPosition--;
            if(facingPosition<0){
                facingPosition=3;
            }
        }
        if (TV.positionToFace==facingPosition){
            System.out.println("the chair is now facing the TV.");
        }
        System.out.println("the chair is now facing "+directionNames[facingPosition]);
    }

    public void sitOnChair() {
        if (You.sitting) {
            System.out.println("you are already sitting");
        }else {
            System.out.println("you sat on the chair");
            You.sitting = true;
        }
    }

    @Override
    public void printMap(int position) {
        facingPosition=1;
        this.position = position;
        Base.positionChair=position;
        setHere(object,position);
        super.printMap(position);
        System.out.println("the chair is currently facing north.\n" +
                "you can type 'turn' when you are beside the chair to rotate it");
    }
}
